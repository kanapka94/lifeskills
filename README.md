# LifeExp

Minimalna aplikacja do gamifikacji ćwiczeń muzycznych. Logujesz się, a dashboard
pokazuje „Cześć, Adam” i osobny pasek XP/poziomu dla każdego projektu z Toggl
Track (np. pianino i pad perkusyjny).

To jest **etap 1**: tylko odczyt czasu z Toggl. Ręczny stoper, tagi, loot,
osiągnięcia, streaki i boss dojdą później — struktura jest na to przygotowana.

## Jak to działa

```
Toggl Track
   │  GET /me
   │  GET /me/projects
   │  POST /reports/api/v3/workspace/{id}/projects/summary
   ▼
SvelteKit (server-only, #lib/server/toggl.ts)
   │  maks. 1 synchronizacja / 10 min
   ▼
SQLite (users, skills, sync_state)
   │
   ▼
Dashboard: „Cześć, Adam” + pasek na każdy projekt
```

- **Projekt Toggl = umiejętność.** Każdy projekt dostaje własny poziom.
- **1 minuta = 10 XP**, czyli `XP = floor(sekundy / 6)`.
- Do przejścia z poziomu `L` na `L+1` potrzeba `100 + (L - 1) * 50` XP.
- Poziom bohatera to poziom z sumy XP wszystkich umiejętności.
- Dane z Toggl trafiają do SQLite jako cache. Bez tego każde odświeżenie strony
  zjadałoby limit API (Free: 30 zapytań/h).

## Wymagania

- Node.js 22.17+ (projekt testowany na Node 24)
- konto Toggl Track i token API

## Uruchomienie

```sh
npm install
cp .env.example .env
```

Uzupełnij `.env`:

```env
SESSION_SECRET=...        # openssl rand -hex 32
ORIGIN=http://localhost:3000
ADMIN_USERNAME=adam
ADMIN_PASSWORD=...        # min. 8 znaków
ADMIN_DISPLAY_NAME=Adam
TOGGL_API_TOKEN=...       # Toggl → Profile Settings → API Token
```

Utwórz konto w bazie:

```sh
npm run db:seed
```

Sprawdź, co zwraca Toggl dla Twojego konta:

```sh
npm run toggl:probe
```

Uruchom aplikację:

```sh
npm run dev
```

Wejdź na <http://localhost:5173/login>.

> Token Toggl i hasło są tylko w `.env`, które jest w `.gitignore`. Token nigdy
> nie trafia do przeglądarki — wszystkie zapytania do Toggl idą z serwera.

## Skrypty

| Komenda               | Co robi                                  |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | serwer developerski                      |
| `npm run build`       | build produkcyjny (adapter-node)         |
| `npm start`           | build produkcyjny na `ORIGIN` z `.env`   |
| `npm run preview`     | podgląd builda Vite                      |
| `npm run check`       | TypeScript + Svelte diagnostics          |
| `npm test`            | testy jednostkowe (XP, daty, rate limit) |
| `npm run db:seed`     | tworzy/aktualizuje konto z `.env`        |
| `npm run toggl:probe` | diagnostyka Toggl API                    |

Start produkcyjny (adapter-node):

```sh
npm run build
npm start
```

Aplikacja wystartuje na `http://localhost:3000` (adres bierze z `ORIGIN`).
`ORIGIN` jest wczytywany podczas `npm run build` i zapisywany w buildzie —
po zmianie adresu lub domeny zrób ponownie `npm run build`. Na serwerze
publicznym ustaw `ORIGIN=https://twoja-domena.pl` i `COOKIE_SECURE=true`.

## Struktura kodu

```
src/
  env.ts                     # definicja i walidacja zmiennych środowiskowych
  hooks.server.ts            # sesja + ochrona stron
  lib/
    game/
      xp.ts                  # cała matematyka XP i poziomów
      format.ts              # formatowanie czasu i dat
      xp.spec.ts
    components/
      ProgressBar.svelte
      SkillCard.svelte
    server/
      db.ts                  # schemat SQLite + zapytania
      app-db.ts              # jedna instancja bazy na proces
      auth.ts                # argon2id
      session.ts             # podpisane cookie HMAC
      rate-limit.ts          # 3 próby / 15 min na IP
      toggl.ts               # cały klient Toggl
      sync.ts                # Toggl → SQLite
  routes/
    +page.server.ts          # dashboard: load, akcje sync/logout
    +page.svelte
    login/+page.server.ts    # logowanie
    login/+page.svelte
scripts/
  seed.ts
  toggl-probe.ts
```

### Dlaczego `better-sqlite3` zamiast ORM-a?

W MVP chodzi o zrozumienie każdego zapytania. `db.ts` zawiera ręczny SQL i
cztery małe funkcje. Gdy projekt urośnie, przejście na Prismę będzie głównie
przepisaniem tego jednego pliku.

### SvelteKit 3 — dwie rzeczy, które mogą zaskoczyć

1. **Alias `#lib` zamiast `$lib`.** To standardowe subpath imports z
   `package.json`. Przy importach plików `.ts` trzeba podać rozszerzenie, np.
   `#lib/server/db.ts`; dla `.svelte` i `.svg` również podajemy pełną nazwę.
2. **Zmienne środowiskowe przez `src/env.ts`.** Zamiast `$env/dynamic/private`
   używamy `defineEnvVars` i importu z `$app/env/private`. Walidacja dzieje się
   przy starcie aplikacji, a nie w środku logiki.

## Bezpieczeństwo

- Hasło: **argon2id** (`@node-rs/argon2`).
- Sesja: cookie `lifeexp_session` podpisane HMAC-SHA256, `HttpOnly`,
  `SameSite=Strict`, 7 dni. Brak tabeli sesji — podpis wystarcza.
- **3 nieudane próby z jednego IP → blokada na 15 minut.** Licznik jest w
  pamięci procesu, więc restart serwera go zeruje. To wystarcza lokalnie; przy
  wdrożeniu publicznym trzeba przenieść licznik do bazy lub Redisa.
- Gdy login nie istnieje, i tak sprawdzany jest „dummy” hash, żeby czas
  odpowiedzi nie zdradzał, czy konto istnieje.
- `TOGGL_API_TOKEN` jest czytany wyłącznie w modułach serwerowych.
- `.env` i katalog `data/` są w `.gitignore`.

## Toggl — ważne ograniczenia

- Darmowy plan: **30 zapytań/h** na użytkownika i organizację.
- `/me/time_entries` cofa się tylko ok. **3 miesiące** i zwraca max 1000 wpisów.
- Raporty v3 przyjmują zakres do **365 dni**, dlatego `splitDateRange()` dzieli
  dłuższy okres na kawałki.
- Aplikacja najpierw używa Reports API. Jeśli workspace/go plan go nie
  udostępnia, schodzi do `/me/time_entries` za ostatnie 90 dni i pokazuje
  ostrzeżenie w UI.

Dlatego po skonfigurowaniu tokena uruchom `npm run toggl:probe`. Skrypt wypisze
konto, projekty oraz sumy czasu i od razu pokaże, czy Reports API działa.

## Jak dodać kolejne funkcje

- **Tagi i mnożniki XP:** `toggl.ts` już zwraca wpisy z polem `tags` (na razie
  używamy tylko sum projektów). Mnożnik najlepiej dodać w `game/xp.ts`, a potem
  przekazać go do `toSkillView()`.
- **Ręczny stoper:** nowa tabela `time_entries` i funkcja w `db.ts`. Dashboard
  nie musi się zmienić — wystarczy, że `load` policzy XP z obu źródeł.
- **Loot, osiągnięcia, streaki:** nowe tabele z kluczem `user_id`; nie ruszamy
  istniejących tabel `users` i `skills`.
- **Tygodniowy boss:** osobna tabela `bosses` + suma XP z zakresu dat. Silnik XP
  jest niezależny od źródła czasu, więc mechanika może korzystać z tych samych
  funkcji.

## Testy

```sh
npm test
```

Testy pokrywają matematykę poziomów, dzielenie zakresów dat dla Reports API,
walidację `TOGGL_START_DATE` oraz blokadę logowania po trzech próbach.
