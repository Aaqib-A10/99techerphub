# Quick Start Guide for 99 Tech ERP

## For Zero-Dev Asim - Start Here!

This guide will get you up and running in minutes. Follow these steps exactly.

### Step 1: Open Terminal

Open Terminal.app on your Mac and navigate to the project folder:

```bash
cd "/sessions/eloquent-happy-lovelace/mnt/99 technologies/99tech-erp"
```

### Step 2: Install Everything

This will download all the software components the app needs:

```bash
npm install
```

This takes 2-5 minutes. You'll see lots of text - that's normal. Wait for it to complete.

### Step 3: Set Up the Database

The app needs a database to store data. Run:

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

**What happens:**
- First command: Prepares the database driver
- Second command: Creates the database tables
- Third command: Fills the database with sample companies, employees, assets

When asked "Do you want to create the database?", answer **yes**.

### Step 4: Start the App

```bash
npm run dev
```

You should see:
```
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

### Step 5: Open in Browser

Click this link or open your browser and go to:
```
http://localhost:3000
```

**You should see the 99 Tech ERP dashboard!**

---

## What You Can Do

### Dashboard
- See total assets count
- See how many are assigned/unassigned
- Quick links to main features

### Assets List
- View all assets
- Filter by company, category, or condition
- See who it's assigned to

### Add New Asset
- Register a new piece of equipment
- Auto-generates asset tag (99T-LAPTOP-0001)
- Tracks purchase date, price, warranty

### Asset Details
- See complete asset information
- Assign asset to an employee
- Return asset when done
- Move asset to another company
- Retire asset when no longer needed

---

## Sample Data Included

The app comes pre-loaded with:
- **6 Companies**: MNC, SJ, PCMART, RTI, LRI, GL
- **11 Departments**: Sales, Support, Development, etc.
- **5 Locations**: Eagan (USA), Dubai, Islamabad (3 floors)
- **10 Asset Categories**: Laptops, Desktops, Monitors, etc.
- **5 Sample Employees**
- **10 Sample Assets**

You can immediately start managing these!

---

## Stop the App

In Terminal, press **Ctrl + C** to stop the server.

---

## Troubleshooting

### "Database connection refused"
- Make sure PostgreSQL.app is running (check your Mac menu bar)
- Verify username is "aqib" (not "postgres")
- Check that database URL in .env is correct

### "npm command not found"
- Node.js may not be installed
- Run: `node -v` to check
- If not installed, install from nodejs.org

### "Address already in use"
- Port 3000 is busy
- Stop other apps using port 3000
- Or change port: `npm run dev -- -p 3001`

### Need to reset everything?
Delete the database and start over:

```bash
dropdb ninety9tech_erp
npm run prisma:push
npm run prisma:seed
npm run dev
```

---

## File Structure Explained

```
99tech-erp/
├── app/                  # Main application code
│   ├── components/       # Reusable UI components
│   ├── api/             # Backend endpoints
│   ├── assets/          # Asset pages
│   ├── page.tsx         # Dashboard page
│   └── layout.tsx       # Main layout
├── prisma/              # Database
│   ├── schema.prisma    # Database structure
│   └── seed.ts          # Sample data
├── lib/                 # Utilities
├── package.json         # Dependencies
└── README.md            # Full documentation
```

---

## Next Steps

Once running, explore:

1. **Dashboard** - See the summary
2. **Assets List** - Browse all equipment
3. **Add New Asset** - Create a new asset
4. **Asset Details** - Click any asset to see full info and manage it

---

## Need Help?

- Check README.md for detailed documentation
- All code comments explain what each part does
- The UI is designed to be intuitive - buttons do what they say

Enjoy managing your assets! 🎉
