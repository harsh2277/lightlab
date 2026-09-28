# Lightmaps - Project Guide & Documentation

Welcome to **Lightmaps**! This guide explains the entire project in simple, plain language. No difficult words, no confusing jargon. 

Anyone joining the team can read this file to understand how the project is organized, how features work, and where to add new things.

---

## Table of Contents
1. [What is Lightmaps?](#what-is-lightmaps)
2. [The 4 Types of Users (Roles)](#the-4-types-of-users-roles)
3. [Full Folder Structure](#full-folder-structure)
4. [Step-by-Step Project Flow](#step-by-step-project-flow)
5. [How to Run the Project](#how-to-run-the-project)
6. [How to Add New Features (Quick Guide)](#how-to-add-new-features-quick-guide)
7. [Change Log & Notes (Update Here When You Make Changes)](#change-log--notes)
8. [Future Feature Ideas / Wishlist](#future-feature-ideas--wishlist)

---

## 1. What is Lightmaps?

**Lightmaps** is a web platform for architectural lighting design projects. 

Instead of sending lighting plans and feedback back and forth over messy emails or WhatsApp chats:
- **Architects** post their projects with room plans and lighting preferences.
- **Admins** manage the studio, review plans, and assign work to designers.
- **Designers** work on the lighting designs and upload files.
- **Clients** get a simple link to view the lighting plan and give their approval or feedback.

---

## 2. The 4 Types of Users (Roles)

| User Role | Who are they? | What can they do? |
| :--- | :--- | :--- |
| **Admin** | Studio owner / manager | Manages all projects, assigns designers, manages users, sees all payments and revision requests. |
| **Architect** | The architect who needs lighting | Creates new projects, uploads floor plans, selects lighting styles, pays invoices, and requests revisions. |
| **Designer** | The lighting specialist | Sees assigned projects, uploads finished lighting files and calculations, and submits revisions. |
| **Client** | End client (homeowner / building owner) | Doesn't need an account. They open a private link to review the lighting design and approve it. |

---

## 3. Full Folder Structure

Here is how all the folders and files are organized:

```text
lightlab/
├── app/                  # All web pages, screens, and backend API routes
├── components/           # Reusable parts of the screen (buttons, cards, menus)
├── public/               # Images, icons, and logos
├── supabase/             # Database settings and migration files
├── tests/                # Automated tests to check if code works
├── utils/                # Helper tools (database connection, file download, etc.)
├── proxy.ts              # Route protection and role check (middleware)
├── package.json          # List of installed packages and run scripts
├── tsconfig.json         # TypeScript setup
└── PROJECT_GUIDE.md      # This guide!
```

---

### Folder Details:

### `app/` (Pages and API Routes)
Everything in Next.js App Router starts here. Each folder inside `app/` represents a URL path in your browser.

- **`app/page.tsx`**: The main root page. Currently redirects to the signup/login page.
- **`app/login/`**: User login page.
- **`app/signup/`**: User registration page.
- **`app/forgot-password/` & `app/reset-password/`**: Password recovery screens.
- **`app/auth/`**:
  - `callback/`: Handles login redirects and checks.
  - `welcome/`: Welcome screen after signup.

#### Role-Based Sections:
- **`app/admin/`**: All pages only visible to Admin users.
  - `dashboard/`: Overview with stats, quick actions, and project counts.
  - `projects/`: List of all projects in the system.
  - `projects/create/`: Create a project manually from admin side.
  - `projects/[id]/`: Detailed view of a single project (assign designer, view files).
  - `calendar/`: Project deadlines on a calendar.
  - `payments/`: Invoices and payment status.
  - `pricing/`: Manage pricing packages and plans.
  - `users/`: List and manage architects, designers, and admins.
  - `revision-requests/`: See all revision requests sent by architects.
  - `profile/`: Admin profile details.
  - `layout.tsx`: Navigation bar and sidebar for Admin.

- **`app/architect/`**: All pages for Architects.
  - `dashboard/`: Overview of their active projects and recent updates.
  - `projects/`: List of their own projects.
  - `projects/create/`: Create a new lighting project with room sizes and preferences.
  - `projects/[id]/`: See status, download files, generate client link.
  - `projects/[id]/revision-request/`: Ask for changes to a design.
  - `calendar/`: Calendar showing their project deadlines.
  - `payments/`: Payment history and Razorpay invoice payment.
  - `profile/`: Architect profile settings.
  - `layout.tsx`: Navigation bar and sidebar for Architect.

- **`app/designer/`**: All pages for Designers.
  - `dashboard/`: Summary of projects assigned to the designer.
  - `projects/`: List of assigned projects.
  - `projects/[id]/`: Project details, room specs, and upload deliverables.
  - `calendar/`: Deadlines for their assigned work.
  - `profile/`: Designer profile settings.
  - `layout.tsx`: Navigation bar and sidebar for Designer.

- **`app/client/`**: Public portal for the end client.
  - `project/[id]/`: Special page where the client can view lighting concepts, view deliverables, and click "Approve" or add notes. No password required.

- **`app/api/`**: Backend API routes (handling data, database queries, and payments).
  - `admin/`: APIs for dashboard data, project assignments, and user management.
  - `architect/`: APIs for architect dashboard.
  - `designer/`: APIs for uploading design files and submitting revisions.
  - `client/`: APIs for client approval and generating secure review links.
  - `payments/`: APIs for Razorpay payment orders and verification.
  - `projects/`: General project fetch and file upload endpoints.
  - `revisions/`: APIs to handle design revision requests.

---

### `components/` (Reusable UI Elements)
Instead of re-writing the same code everywhere, we break the visual elements into reusable pieces:

- **`components/layout/`**:
  - `Sidebar.tsx`: The left navigation menu bar.
  - `Topbar.tsx`: The top bar with search, user name, and notifications.

- **`components/ui/`**: Small building blocks used across all pages:
  - `Button.tsx`: Buttons with different colors and states.
  - `Card.tsx` & `StatsCard.tsx`: White and dark boxes for showing information and numbers.
  - `Badge.tsx`: Colorful tags (e.g., "Active", "Pending", "Approved", "Paid").
  - `Modal.tsx` & `ConfirmModal.tsx`: Pop-up dialog windows.
  - `InputField.tsx` & `PasswordInput.tsx`: Form input boxes.
  - `CustomSelect.tsx`: Dropdown menus.
  - `SearchInput.tsx`: Search boxes.
  - `Toast.tsx`: Small popup messages (e.g., "Saved successfully!").
  - `LoadingSpinner.tsx` & `SkeletonLoader.tsx`: Smooth loading placeholders while waiting for data.
  - `DeadlineCalendar.tsx`: Calendar view for deadlines.
  - `InvoiceModal.tsx`: Pop-up to view or download invoices.
  - `InteractiveRoomLightingCards.tsx`: Visual cards showing room lighting styles.
  - `PricingShowcase.tsx`: Pricing plan display cards.

---

### `utils/` (Helper Tools)
Helpful code functions that keep the rest of the project clean:
- **`utils/supabase/client.ts`**: Connects to Supabase from the browser.
- **`utils/supabase/server.ts`**: Connects to Supabase from server components and API routes.
- **`utils/supabase/admin.ts`**: Connects to Supabase with admin permissions (bypasses restrictions when needed).
- **`utils/supabase/authorize.ts`**: Checks if the user is allowed to view or edit something.
- **`utils/clientLinkToken.ts`**: Makes and verifies secure links for clients.
- **`utils/downloadFile.ts`**: Helper to download files to user's computer.
- **`utils/rateLimit.ts`**: Stops users or bots from making too many requests too fast.

---

### `supabase/` (Database)
- **`supabase/migrations/`**: Contains SQL files.
  - `001_performance_indexes.sql`: Fast search indexes for projects, payments, revisions, and profiles.

---

### `tests/` (Automated Tests)
- Uses Playwright to make sure everything works smoothly.
  - `tests/e2e/auth.spec.ts`: Tests login and signup.
  - `tests/e2e/admin-projects.spec.ts`: Tests admin project flow.
  - `tests/e2e/security.spec.ts`: Tests security and access permissions.
  - `tests/e2e/accessibility.spec.ts`: Tests screen reader and keyboard access.

---

## 4. Step-by-Step Project Flow

Here is the life cycle of a project in LightLab:

```text
[Architect] Creates Project & enters room details
    │
    ▼
[Architect] Pays for the project (Razorpay)
    │
    ▼
[Admin] Sees project & assigns a [Designer]
    │
    ▼
[Designer] Works on lighting plan & uploads design files
    │
    ▼
[Architect] Reviews design & shares Client Link
    │
    ▼
[Client] Opens link → Approves or Requests Changes
    │
    ▼
[Project Completed] or [Revision Done by Designer]
```

---

## 5. How to Run the Project

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Check Environment Variables**:
   Make sure you have a `.env.local` file with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Razorpay keys (for payments)

3. **Start the local server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run tests**:
   ```bash
   npm run test:e2e
   ```

---

## 6. How to Add New Features (Quick Guide)

When you want to add something new to this project, follow this simple checklist:

### A. If you are adding a new Page:
1. Decide which role owns the page (`admin`, `architect`, or `designer`).
2. Create a folder in `app/<role>/<page-name>/` with a `page.tsx` file.
3. Add the link into `navItems` in `app/<role>/layout.tsx` so it appears in the sidebar.

### B. If you are adding a new API endpoint:
1. Create a folder in `app/api/<group>/<name>/` with a `route.ts` file.
2. Check user permissions using `utils/supabase/server.ts` or `utils/supabase/authorize.ts`.
3. Return clean JSON with `NextResponse.json(...)`.

### C. If you are adding a new UI Button or Card:
1. Put the component in `components/ui/<Name>.tsx`.
2. Export it from `components/ui/index.ts` so other files can import it easily.

### D. Always remember:
- Keep styles simple and consistent using Tailwind classes.
- Use `useToast()` from `@/components/ui` to show success and error messages to users.
- Use `SkeletonLoader` or `LoadingSpinner` when data is loading.

---

## 7. Change Log & Notes

> **Note for Developers**: Whenever you make a change, fix a bug, or add a feature, write a quick note below. Keep it simple and clear!

### Template to Copy:
```markdown
### [Date: YYYY-MM-DD] - [Short Title of Change]
- **What was changed**: (Describe what you did in simple words)
- **Why**: (Why was this change needed?)
- **Files touched**: 
  - `path/to/file.tsx`
- **Author**: (Your name)
```

---

### [2026-09-28] - Official New Logo (/new-logo.png) Updated Across Entire Portal
- **What was changed**: Replaced and updated the logo across all sections of the application with the new logo (`/new-logo.png`):
  1. **Sidebars**: Updated Admin, Architect, and Designer navigation sidebars to render `/new-logo.png`.
  2. **Invoices**: Updated printable invoices and modal letterheads to render `/new-logo.png`.
  3. **Authentication Screens**: Added the official new logo and branding to `AuthLayout` so Login, Sign Up, Forgot Password, and Reset Password pages showcase `/new-logo.png`.
  4. **Client Review Portal**: Updated homeowner review portal headers to display `/new-logo.png`.
  5. **Favicon & Apple Icons**: Updated `public/favicon.ico`, `public/Logo.png`, and root layout metadata icons (`/new-logo.png`).
- **Why**: Client provided the new official logo file (`new-logo.png`).
- **Files touched**:
  - `public/new-logo.png`
  - `public/Logo.png`
  - `public/favicon.ico`
  - `components/layout/Sidebar.tsx`
  - `components/ui/InvoiceModal.tsx`
  - `components/ui/AuthLayout.tsx`
  - `app/client/project/[id]/page.tsx`
  - `app/layout.tsx`
- **Author**: Lightmaps Team

---

### [2026-09-28] - Pricing Plans Most Popular Toggle & Plan Count Sync
- **What was changed**:
  1. **Most Popular Toggle**: Added a 1-click toggle button on every pricing card in Admin Pricing, plus toggle switches in the "Add Plan" and "Edit Plan" modals. Turning on "Most Popular" updates the database (`is_popular = true`) and displays the highlighted badge and amber border for architects.
  2. **Plan Count Sync (5 Plans Fixed)**: Fixed the discrepancy where Admin was displaying 5 plans while Architect was only displaying 3. Inserted `Amplex Essential` and `Amplex Professional` as real database records in Supabase so that all 5 plans exist natively in the database. Removed phantom fallback injection from Admin so both portals load the exact same 5 real plans from the database. Updated the grid layout to 5 columns on desktop screens.
- **Why**: Client requested a toggle to control which plan is "Most Popular", and reported that the Admin side showed 5 plans while the Architect side only showed 3.
- **Files touched**:
  - `app/admin/pricing/page.tsx`
  - `app/architect/projects/create/page.tsx`
  - `app/admin/projects/create/page.tsx`
  - Supabase table `pricing_plans`
- **Author**: Lightmaps Team

---

### [2026-09-28] - Profile Option Added to Header Dropdown Menu
- **What was changed**: Added a direct "Profile" link inside the user avatar popup menu in the top navigation bar. When clicked, it takes the user straight to their profile settings page (`/admin/profile`, `/architect/profile`, or `/designer/profile`).
- **Why**: Users could only see "Sign Out" in the top-right user menu. Adding "Profile" allows admins and users to quickly access their account and password settings.
- **Files touched**:
  - `components/layout/Topbar.tsx`
  - `app/admin/layout.tsx`
  - `app/architect/layout.tsx`
  - `app/designer/layout.tsx`
- **Author**: Lightmaps Team

---

### [2026-09-28] - 10 Client Feedback Portal Fixes & Enhancements
- **What was changed**:
  1. **Password Change in Admin**: Added self password update in Admin Profile, and user password reset in User Directory.
  2. **Export User Master**: Added "Export CSV" button in Admin User Directory to download all users in one click.
  3. **Admin Pricing Plan Persistence**: Fixed Admin Pricing to save discount tags, regular rates, area ranges, features, and revision limits into the database.
  4. **Live Plans in Architect Portal**: Connected dynamic database pricing plans to the Architect project creation wizard.
  5. **Brand Name Update**: Updated name from "LightMap" to "Lightmaps" across all sidebars, headers, titles, and invoices.
  6. **Logo & Favicon**: Connected local `/Logo.png` and `/favicon.ico` across layout, sidebars, and invoices.
  7. **Payment Pending Guard**: Blocked project progression and designer assignment when project payment status is unpaid.
  8. **Client Revision Requests**: Added "Request Revision" button and modal in the Client Portal with plan revision quota tracking.
  9. **Pay Invoice Gateway**: Added Razorpay "Pay Now" button in Architect Payments table and Invoice modal for unpaid invoices.
  10. **Admin Controls Cancel Bug Fix**: Fixed cancellation in Project Settings & Controls to reset dirty values back to saved state.
- **Why**: Client reported 10 critical issues and workflow requirements.
- **Files touched**:
  - `app/admin/profile/page.tsx`
  - `app/admin/users/page.tsx`
  - `app/api/admin/users/route.ts`
  - `app/admin/pricing/page.tsx`
  - `app/architect/projects/create/page.tsx`
  - `app/architect/payments/page.tsx`
  - `app/admin/projects/[id]/page.tsx`
  - `app/api/admin/projects/assign/route.ts`
  - `app/client/project/[id]/page.tsx`
  - `components/layout/Sidebar.tsx`
  - `components/ui/InvoiceModal.tsx`
  - `app/layout.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/reset-password/page.tsx`, `app/auth/welcome/page.tsx`, `app/designer/dashboard/page.tsx`
- **Author**: Lightmaps Team

---

### [2026-09-28] - Project Documentation Created
- **What was changed**: Created the central `PROJECT_GUIDE.md` file.
- **Why**: To provide a clean, easy-to-read overview of all folders, user roles, project flow, and instructions for team members.
- **Files touched**:
  - `PROJECT_GUIDE.md`
- **Author**: Lightmaps Team

---