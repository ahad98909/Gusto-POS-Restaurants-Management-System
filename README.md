# Gusto POS 🍕

Gusto POS is a robust, production-ready, **Real-Time Full-Stack Restaurant Point of Sale (POS)** system. It is designed to handle all aspects of restaurant operations seamlessly, utilizing a **multi-role workflow** that connects order takers, kitchen staff, billing agents, managers, and owners in real-time.

---

## 🚀 Key Highlights & Architecture

* **⚡ Real-Time Sync:** Uses **WebSockets** for instant, low-latency communication. Orders placed by order takers instantly appear on the kitchen display, and payment status updates are immediately synchronized.
* **👥 5 Role-Specific Dashboards:**
  * **Order Takers:** Seat tables, browse the menu, customize items, manage carts, and send orders straight to the kitchen.
  * **Chefs (Kitchen Display System):** Real-time ticket management, showing pending orders, active dishes, preparation timers, and fulfillment controls.
  * **Billing Agents:** Automated tax and discount calculations, billing generation, payment status management (cash/card), and receipt generation.
  * **Managers:** Administer restaurant tables, edit menu items, set pricing, manage employee accounts, and review active sessions.
  * **Owners (Analytics Portal):** Direct insights into business performance, total sales, item popularity charts, active employee metrics, and overall revenue logs.
* **📂 Automated Windows Setup:** Includes helper scripts to configure environment variables, setup databases, manage Python virtual environments, and boot up components instantly.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Tailwind CSS / Vanilla CSS, React Context API, WebSocket Client.
* **Backend:** FastAPI (Python), WebSockets, Pydantic, SQLAlchemy ORM, Uvicorn.
* **Database:** MySQL (optimized with helper views) / SQLite fallback.

## 🐳 Docker Setup

Gusto POS is fully containerized and can be spun up using Docker Compose:

### 1. Build and Run containers
In the root directory, run:
```bash
docker compose up --build
```
This command starts:
- **`db` (MySQL 8.0)** on port `3306` (with data persisted in a named volume).
- **`backend` (FastAPI)** on port `8000`.
- **`frontend` (React + Nginx)** on port `80`.

Once started, the application is accessible at `http://localhost`.

### 2. Seed the Database (Required for First Run)
To seed the default roles/users and database views inside the running Docker container, execute:
```bash
docker exec -it gusto_pos_backend python init_db.py
```
After running this, you can log in immediately using the Quick Demo buttons on the login page or custom credentials.

---

## ⚡ Vercel Deployment (Frontend)

To deploy the React frontend to Vercel:

1. Import the repository (or the `frontend` subdirectory) to Vercel.
2. Select **Vite** as the framework preset (it will automatically configure build command `npm run build` and output directory `dist`).
3. Set the following environment variables under Project Settings:
   - `VITE_API_URL`: The URL of your deployed backend API (e.g., `https://api.yourbackend.com`). Do not include a trailing slash.
   - `VITE_WS_URL`: The WebSocket URL of your deployed backend API (e.g., `wss://api.yourbackend.com/ws`).
4. Vercel will build the frontend and serve it with the configuration in `vercel.json` to handle SPA routing fallback.

---

## ⚙️ Quick Installation & Setup (Windows)

This repository is optimized for quick setup on Windows:

### 1. Configure the Environment
Run the main setup script in your project root folder:
```bash
python setup_env.py
```
This will automatically create a virtual environment (`.venv`), install all required Python packages, download portable Node.js if needed, and generate execution scripts.

### 2. Configure & Start MySQL
If you are running MySQL locally on Windows:
1. Double-click the **`setup_mysql_service.bat`** file in the root folder.
2. Grant Administrator permissions when prompted.
> This script automatically configures the Windows MySQL service (`MYSQL80`) to start automatically when your computer boots and runs it immediately.

### 3. Run the Application
Double-click the following batch files to start:
* **`run_backend.bat`:** Starts the FastAPI Backend server on `http://localhost:8000`.
* **`run_frontend.bat`:** Starts the React/Vite development server on `http://localhost:5173`.

---

## 📊 Database Schema Views

When using MySQL, the database automatically provisions three helper views to assist in direct analytics reporting:
* `v_attendance`: Tracks employee login sessions, shift hours, and role data.
* `v_orders`: Aggregates active orders, corresponding tables, total amounts, and serving statuses.
* `v_bills`: Details payment methods, applied discounts, tax breakdowns, and final transaction states.
