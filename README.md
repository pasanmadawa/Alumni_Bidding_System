# Alumni Bidding System

An advanced server-side coursework project for managing alumni profiles, alumni trend graphs, authentication, and a blind bidding workflow for featured alumni placement.

The system has two main applications:

- `server_side`: Express.js API with Prisma and MySQL
- `client_side`: React + Vite frontend

## Main Features

- User registration, login, JWT authentication, refresh tokens, logout, and account deletion
- Email verification, login OTP, forgot password, and password reset
- Role-based access for `ALUMNUS`, `SPONSOR`, `ADMIN`, and `STUDENT`
- Alumni profile management with image upload
- Profile sections for degrees, certifications, licences, courses, employment, and specialised areas
- Profile completion tracking
- Dashboard, graphs page, alumni directory page, profile page, and bid page
- Graphs for curriculum skills, specialised areas, industry sectors, job titles, employers, and geographic distribution
- Alumni viewing/filtering by programme, graduation date, and industry sector
- Blind bidding for featured alumni placement
- Bid placement, bid increase, cancellation, status display, and bid history tracking
- Monthly featured limit enforcement with default 3 wins per month
- Admin event credit support for extra monthly wins
- Automated winner selection using a cron scheduler

## Tech Stack

- Backend: Node.js, Express.js
- Database: MySQL
- ORM: Prisma
- Authentication: JWT, refresh tokens, bcrypt
- Email: Nodemailer
- Scheduler: node-cron
- Frontend: React, Vite, React Router
- Styling: CSS

## Project Structure

```text
Implementation/
  client_side/
    src/
      pages/
      components/
      lib/
    package.json
  server_side/
    prisma/
      schema.prisma
    routes/
    lib/
    middleware/
    public/
    index.js
    package.json
```

## Prerequisites

- Node.js
- MySQL Server
- npm

## Backend Setup

1. Install dependencies:

```powershell
cd server_side
npm install
```

2. Create the environment file:

```powershell
copy .env.example .env
```

3. Update `.env` with your MySQL credentials and email settings:

```env
DATABASE_URL="mysql://root:your_mysql_password@localhost:3306/alumni_bidding_system"
APP_BASE_URL="http://localhost:3000"
PORT=3000
ALLOWED_EMAIL_DOMAINS="westminster.ac.uk,iit.ac.lk"
JWT_ACCESS_SECRET="secret_access_key_2000"
JWT_REFRESH_EXPIRES_DAYS="7"
JWT_ACCESS_EXPIRES_IN="15m"
BID_SELECTION_CRON="0 18 * * *"
BID_SELECTION_TIMEZONE="Asia/Colombo"
MONTHLY_FEATURE_LIMIT="3"
SMTP_SERVICE="gmail"
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_gmail_app_password"
EMAIL_FROM="your_email@gmail.com"
```

4. Sync Prisma schema with MySQL:

```powershell
npx prisma db push
```

5. Generate Prisma Client:

```powershell
npx prisma generate
```

6. Start the backend:

```powershell
npm run dev
```

If PowerShell blocks npm scripts, use:

```powershell
npm.cmd run dev
```

Backend runs on:

```text
http://localhost:3000
```

## Frontend Setup

1. Install dependencies:

```powershell
cd client_side
npm install
```

2. Start the frontend:

```powershell
npm run dev
```

If PowerShell blocks npm scripts, use:

```powershell
npm.cmd run dev
```

Frontend usually runs on:

```text
http://localhost:5173
```

If the frontend and backend run on different origins, configure `VITE_API_BASE_URL` for the frontend.

## Frontend Pages

- `/`: Public landing page
- `/login`: Login page
- `/signup`: Registration page
- `/forgot-password`: Forgot password page
- `/reset-password`: Password reset page
- `/verify-email`: Email verification page
- `/dashboard`: Main dashboard overview
- `/graphs`: Graphs and trend filters
- `/alumni`: Alumni directory filters for sponsors/admins
- `/profile`: Profile management
- `/bids`: Blind bidding and featured alumni tools

## Important API Routes

Authentication:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `DELETE /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET or POST /auth/verify-email`

Profile:

- `GET /api/profile/me`
- `PUT /api/profile/me`
- `PATCH /api/profile/me/basic`
- `PATCH /api/profile/me/linkedin`
- `GET /api/profile/me/completion-status`
- `POST /api/profile/me/image`
- `POST /api/profile/me/:section`
- `PATCH /api/profile/me/:section/:itemId`
- `DELETE /api/profile/me/:section/:itemId`

Bidding:

- `GET /api/bids/featured/current`
- `GET /api/bids/reveal/current`
- `GET /api/bids/me?targetFeaturedDate=YYYY-MM-DD`
- `GET /api/bids/history?targetFeaturedDate=YYYY-MM-DD`
- `POST /api/bids/me`
- `PUT /api/bids/me/increase`
- `DELETE /api/bids/me?targetFeaturedDate=YYYY-MM-DD`
- `POST /api/bids/select-winner`
- `POST /api/bids/event-credit`

Graphs and alumni:

- `GET /api/trends`
- `GET /api/trends?programme=...&graduationDate=...&industrySector=...`
- `GET /api/alumni`
- `GET /api/alumni?programme=...&graduationDate=...&industrySector=...`
- `GET /api/alumni/:userId`
- `DELETE /api/alumni/:userId`

## Blind Bidding Flow

1. An alumnus selects a target featured date.
2. The alumnus places a bid.
3. The alumnus can only increase an existing bid, not decrease it.
4. The highest bid amount is not revealed to other users.
5. The user sees their own blind status and monthly limit information.
6. Each placement/increase is stored in bid history.
7. Winner selection can be run by an admin or automatically through the scheduler.
8. The winning bid is marked as `WON`; other bids are marked as `LOST`.
9. Featured alumni can be revealed after winner selection.

## Monthly Limit Rule

The default monthly featured limit is controlled by:

```env
MONTHLY_FEATURE_LIMIT="3"
```

An alumnus cannot win more than the allowed number of featured placements in a month unless an admin grants extra event credits.

## Common Commands

Backend:

```powershell
cd server_side
npm.cmd run dev
npx.cmd prisma validate
npx.cmd prisma db push
npx.cmd prisma generate
```

Frontend:

```powershell
cd client_side
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
```

## Notes

- Restart the backend after changing Prisma schema or backend route files.
- Run `npx prisma generate` after Prisma schema changes.
- Run `npx prisma db push` when database tables need to be created or updated.
- Email uses real SMTP when SMTP variables are configured. Without SMTP credentials, mailer behavior may be simulated depending on the backend configuration.
