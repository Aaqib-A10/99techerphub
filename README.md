# 99 Technologies ERP - Asset Management System

A comprehensive Asset Management System built with Next.js 14, Prisma, and PostgreSQL.

## Prerequisites

- Node.js v24.14.1 or higher
- PostgreSQL 18 running on localhost:5432
- npm or yarn package manager

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Create Database and Push Schema

```bash
npm run prisma:push
```

When prompted, you can create the database or it will be created automatically.

### 4. Seed the Database

This will populate the database with sample data (companies, departments, locations, categories, employees, and assets):

```bash
npm run prisma:seed
```

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Features

### Dashboard
- Summary statistics showing:
  - Total assets count
  - Assigned vs. unassigned assets
  - Assets by company
  - Assets by condition

### Assets Management
- View all assets with filtering by:
  - Company
  - Category
  - Condition
- Add new assets with:
  - Auto-generated asset tags (format: 99T-[CATEGORY]-[SEQUENCE])
  - Serial number tracking
  - Purchase information (date, price, currency)
  - Warranty tracking
  - Detailed notes

### Asset Operations
- **Assign**: Assign assets to employees with notes
- **Return**: Return assets from employees with condition updates
- **Transfer**: Transfer assets between companies
- **Retire**: Retire assets from active inventory

### Asset Details
- Full asset information display
- Assignment history with timeline
- Transfer history tracking
- Audit logging of all changes

### Database Schema

#### Core Models
- **Company**: Multiple companies/subsidiaries
- **Department**: Employee departments
- **Location**: Physical asset locations
- **AssetCategory**: Asset classification (10 categories)
- **Employee**: Employee records with departments
- **Asset**: Main asset inventory
- **AssetAssignment**: Asset-to-employee assignments
- **AssetTransfer**: Inter-company asset transfers
- **AuditLog**: Complete change history

## API Routes

### Assets
- `GET /api/assets` - List assets with filters
- `POST /api/assets` - Create new asset
- `GET /api/assets/[id]` - Get asset details
- `PUT /api/assets/[id]` - Update asset
- `POST /api/assets/[id]/assign` - Assign asset to employee
- `POST /api/assets/[id]/return` - Return asset from employee
- `POST /api/assets/[id]/transfer` - Transfer asset to company
- `POST /api/assets/[id]/retire` - Retire asset

### Lookups
- `GET /api/employees` - List active employees
- `GET /api/companies` - List active companies
- `GET /api/categories` - List asset categories
- `GET /api/locations` - List locations
- `GET /api/dashboard/stats` - Dashboard statistics

## Data Model

### Seed Data Included

**Companies**: MNC, SJ, PCMART, RTI, LRI, GL
**Departments**: Sales, Customer Support, Development, Marketing, Admin/HR, Finance, ITAD, E-Commerce, QA, Medical Billing, Digital Marketing
**Locations**:
- Eagan Office (USA)
- Dubai Office (UAE)
- Islamabad HQ Floors 3, 4, 5 (Pakistan)

**Asset Categories**:
- Laptop
- Desktop PC
- Monitor
- Mobile Phone
- iPad/Tablet
- Headset
- Mouse/Keyboard
- Network Equipment
- Furniture
- Software License

**Sample Assets**: 10 assets pre-populated for testing

## Development

### Available Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run prisma:generate  # Generate Prisma client
npm run prisma:push     # Push schema to database
npm run prisma:seed     # Seed database with initial data
npm run prisma:studio   # Open Prisma Studio GUI
```

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL 18
- **ORM**: Prisma 5.7
- **Styling**: Tailwind CSS 3.4
- **Language**: TypeScript 5.3

## Color Scheme

The application uses the 99 Technologies brand colors:
- Primary Green: #1B5E20
- Secondary Green: #2E7D32
- Light Green: #E8F5E9
- Sidebar: Slate gray gradient

## User Features

- Professional dark sidebar with 99 Tech branding
- Responsive design (mobile, tablet, desktop)
- Color-coded asset condition indicators
- Clean, intuitive interface
- Real-time data updates
- Comprehensive audit trails

## Future Modules

Currently implemented:
- ✅ Asset Management

Coming soon:
- Employee Management
- Expense Tracking
- Reports & Analytics
- Depreciation Tracking

## Support

For issues or questions, contact the development team.

---

**Version**: 1.0.0
**Last Updated**: April 2026
**Developed for**: 99 Technologies
