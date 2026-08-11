# Procurement System - Libraries Documentation

This document provides a comprehensive overview of the libraries and technologies used for purchase request layout, purchase order layout, and other document layouts in the procurement system.

---

## Table of Contents
1. [Frontend Libraries](#frontend-libraries)
2. [Backend Libraries](#backend-libraries)
3. [Layout-Specific Libraries](#layout-specific-libraries)
4. [Document Types](#document-types)
5. [Database Schema](#database-schema)
6. [Architecture Overview](#architecture-overview)

---

## Frontend Libraries

### Core Framework
- **React (v19.2.0)** - Core JavaScript library for building user interfaces
  - Used for all UI components including layout designers, previews, and document forms
  - Component-based architecture for reusable layout elements

- **React DOM (v19.2.0)** - React renderer for web browsers
  - Enables React components to render in the DOM

- **React Router DOM (v7.13.1)** - Routing library for React applications
  - Manages navigation between different layout and document pages
  - Handles route-based access control for layout designer

### Data Handling & APIs
- **Axios (v1.13.5)** - HTTP client for making API requests
  - Used to communicate with backend layout services
  - Handles layout CRUD operations (create, read, update, delete)
  - Manages authentication tokens for layout access

### Layout Design & Excel Integration
- **XLSX (v0.18.5)** - Excel file parsing and generation library
  - **Primary library for Excel-based layout designer**
  - Used in `VisualBuilder.jsx` for creating and editing Excel-based layouts
  - Supports reading/writing Excel files for custom document templates
  - Enables cell-level editing and spreadsheet manipulation for layouts
  - Key features used:
    - `XLSX.read()` - Parse Excel files for layout import
    - `XLSX.write()` - Generate Excel files for layout export
    - `XLSX.utils.book_new()` - Create new workbook structures
    - `XLSX.utils.aoa_to_sheet()` - Convert arrays to Excel sheets
    - `XLSX.utils.decode_range()` - Parse cell ranges
    - `XLSX.utils.encode_cell()` - Format cell addresses

### UI Components & Styling
- **Tailwind CSS (v4.1.18)** - Utility-first CSS framework
  - Provides styling for all layout components
  - Responsive design for layout designer interfaces
  - Custom styling for document previews and modals

- **Lucide React (v0.563.0)** - Icon library
  - Provides icons for layout designer toolbar (Save, Upload, Download, etc.)
  - Used throughout the UI for visual consistency
  - Icons include: Plus, Trash2, Edit, Eye, Download, Upload, FileText, Layout, Code, Check, X, AlertCircle, Copy

### Data Visualization
- **Recharts (v3.7.0)** - Chart library for data visualization
  - Used for analytics and reporting dashboards
  - Can be integrated with layout data for visual reports

### Real-time Features
- **Socket.io Client (v4.8.3)** - WebSocket client for real-time communication
  - Enables real-time updates for layout changes
  - Supports collaborative layout editing features
  - Live notifications for layout approvals and changes

### Development Tools
- **Vite (v7.2.4)** - Build tool and development server
  - Fast development server with hot module replacement
  - Optimized production builds for layout components

- **Vitest (v4.1.8)** - Testing framework
  - Unit testing for layout logic and components
  - Coverage reporting for layout-related code

---

## Backend Libraries

### Core Framework
- **Express.js (v4.18.2)** - Web application framework
  - RESTful API endpoints for layout management
  - Middleware for authentication and validation
  - Routes for layout CRUD operations

### Database
- **MySQL2 (v3.12.0)** - MySQL database driver with Promise support
  - Manages layout storage in MySQL database
  - Handles JSON data type for layout configurations
  - Transaction support for layout versioning

### Excel Generation
- **ExcelJS (v4.4.0)** - Excel file generation library
  - **Backend Excel generation for document exports**
  - Used to generate Excel files from layout configurations
  - Supports formatting, styling, and complex Excel features
  - Can convert layout JSON to formatted Excel documents

### Real-time Server
- **Socket.io (v4.8.3)** - WebSocket server
  - Real-time communication for layout updates
  - Broadcasts layout changes to connected clients
  - Supports collaborative editing features

### Authentication & Security
- **JSON Web Token (jsonwebtoken v9.0.2)** - JWT authentication
  - Secures layout API endpoints
  - User authentication for layout access control

- **Bcryptjs (v2.4.3)** - Password hashing library
  - Secure password storage for layout system users

- **Helmet (v8.1.0)** - Security middleware
  - Sets secure HTTP headers for layout API
  - Protects against common web vulnerabilities

- **Express Rate Limit (v8.2.1)** - Rate limiting middleware
  - Protects layout API from abuse
  - Limits request frequency for layout operations

- **XSS (v1.0.15)** - XSS protection middleware
  - Sanitizes user input in layout configurations
  - Prevents cross-site scripting attacks

### Input Validation
- **Express Validator (v7.0.1)** - Request validation middleware
  - Validates layout configuration data
  - Ensures data integrity for layout structures

### File Handling
- **Multer (v1.4.5-lts.1)** - File upload middleware
  - Handles Excel file uploads for layout import
  - Manages multipart form data for layout templates

### Cross-Origin Support
- **CORS (v2.8.5)** - Cross-Origin Resource Sharing middleware
  - Enables frontend-backend communication
  - Allows layout API access from different origins

### Environment & Configuration
- **Dotenv (v16.3.1)** - Environment variable management
  - Manages configuration for layout system
  - Database credentials and API settings

### HTTP Client
- **Axios (v1.13.5)** - HTTP client for external API calls
  - Used for integrating with external services
  - Can fetch external data for layout templates

---

## Layout-Specific Libraries

### Primary Layout Library: XLSX

The **XLSX library (SheetJS)** is the core library used for layout design and manipulation:

**Usage in Layout Designer:**
- **File**: `frontend/src/components/layout-designer/VisualBuilder.jsx`
- **Purpose**: Excel-based visual layout builder
- **Features**:
  - Create new Excel-based layouts from scratch
  - Import existing Excel files as layout templates
  - Cell-level editing with double-click functionality
  - Undo/redo functionality for layout changes
  - Zoom controls for layout preview
  - Export layouts as Excel files

**Key XLSX Functions Used:**
```javascript
// Reading Excel files
XLSX.read(data, { type: 'base64' })  // Read base64 encoded Excel
XLSX.read(data)                       // Read ArrayBuffer

// Writing Excel files
XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

// Workbook operations
XLSX.utils.book_new()                 // Create new workbook
XLSX.utils.book_append_sheet()       // Add sheets to workbook

// Sheet operations
XLSX.utils.aoa_to_sheet()             // Convert array to sheet
XLSX.utils.decode_range()            // Parse cell range (e.g., "A1:Z10")
XLSX.utils.encode_range()            // Format cell range
XLSX.utils.decode_cell()             // Parse cell address (e.g., "A1")
XLSX.utils.encode_cell()             // Format cell address
XLSX.utils.encode_col()             // Get column letter from index
```

### Custom JSON Layout System

In addition to Excel-based layouts, the system uses a **custom JSON-based layout configuration**:

**JSON Structure** (defined in `CodeEditor.jsx`):
```json
{
  "sections": [
    {
      "id": "unique_section_id",
      "type": "section|header|footer|table|signatures",
      "fields": [
        {
          "id": "unique_field_id",
          "type": "text|number|currency|date|image|table|checkbox|signature",
          "label": "Field Label",
          "properties": {
            "width": "100%",
            "height": "auto",
            "fontSize": "14px",
            "fontWeight": "normal",
            "textAlign": "left",
            "backgroundColor": "transparent",
            "color": "#000000",
            "borderWidth": "0px",
            "borderColor": "#000000",
            "padding": "8px"
          }
        }
      ]
    }
  ],
  "style": {
    "pageSize": "A4",
    "orientation": "portrait",
    "margins": {
      "top": "0.5in",
      "bottom": "0.5in",
      "left": "0.5in",
      "right": "0.5in"
    }
  }
}
```

**Usage:**
- **File**: `frontend/src/components/layout-designer/CodeEditor.jsx`
- **Purpose**: JSON-based layout configuration editor
- **Features**:
  - Direct JSON editing for layout configurations
  - JSON validation with real-time error checking
  - Format/copy/download/upload JSON configurations
  - Syntax help and structure documentation

---

## Document Types

The layout system supports multiple document types, each with customizable layouts:

### 1. Purchase Request Layout
- **Purpose**: Layout for purchase request documents
- **Default Fields**: Company logo, company name, PR number, date prepared, supplier info, items table, signatures
- **Components**: `frontend/src/components/purchase-requests/PRPreviewModal.jsx`
- **Database Key**: `purchase_request`

### 2. Purchase Order Layout
- **Purpose**: Layout for purchase order documents
- **Default Fields**: Company info, PO number, supplier details, items table, totals, terms
- **Components**: `frontend/src/components/purchase-orders/PurchaseOrders.jsx`
- **Database Key**: `purchase_order`

### 3. Payment Request Layout
- **Purpose**: Layout for payment request documents
- **Default Fields**: Document title, payee information, payment details, amount breakdown
- **Database Key**: `payment_request`

### 4. Disbursement Voucher Layout
- **Purpose**: Layout for disbursement voucher documents
- **Default Fields**: DV number, payee info, payment details, particulars
- **Database Key**: `disbursement_voucher`

### 5. Cash Request Layout
- **Purpose**: Layout for cash request documents
- **Default Fields**: Request details, amount, purpose, approval signatures
- **Database Key**: `cash_request`

### 6. Reimbursement Layout
- **Purpose**: Layout for reimbursement documents
- **Default Fields**: Employee info, expense details, amount, approvals
- **Database Key**: `reimbursement`

---

## Database Schema

### document_layouts Table
Stores the main layout configurations for each document type.

**File**: `backend/database/migrations/create_document_layouts_table.sql`

```sql
CREATE TABLE document_layouts (
  id int(11) NOT NULL AUTO_INCREMENT,
  document_type varchar(50) NOT NULL COMMENT 'Type of document (purchase_request, purchase_order, etc.)',
  name varchar(255) NOT NULL COMMENT 'Display name for the layout',
  layout_config json NOT NULL COMMENT 'JSON configuration for the layout structure',
  is_active tinyint(1) DEFAULT 1 COMMENT 'Whether this layout is currently active',
  is_default tinyint(1) DEFAULT 0 COMMENT 'Whether this is the default layout for the document type',
  created_by int(11) DEFAULT NULL COMMENT 'ID of employee who created this layout',
  updated_by int(11) DEFAULT NULL COMMENT 'ID of employee who last updated this layout',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY document_type (document_type),
  KEY is_active (is_active),
  KEY created_by (created_by),
  CONSTRAINT document_layouts_created_by_fk FOREIGN KEY (created_by) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT document_layouts_updated_by_fk FOREIGN KEY (updated_by) REFERENCES employees (id) ON DELETE SET NULL
)
```

**Key Fields:**
- `document_type`: Identifies which document type the layout belongs to
- `layout_config`: JSON object containing the layout structure (Excel data or JSON configuration)
- `is_default`: Marks the default layout for each document type
- `is_active`: Enables/disables layouts without deletion

### layout_versions Table
Stores version history for layout configurations.

**File**: `backend/database/migrations/create_layout_versions_table.sql`

```sql
CREATE TABLE layout_versions (
  id int(11) NOT NULL AUTO_INCREMENT,
  layout_id int(11) NOT NULL COMMENT 'Reference to the parent layout',
  version int(11) NOT NULL COMMENT 'Version number',
  layout_config json NOT NULL COMMENT 'JSON configuration for this version',
  change_description text DEFAULT NULL COMMENT 'Description of changes made in this version',
  created_by int(11) DEFAULT NULL COMMENT 'ID of employee who created this version',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_layout_version (layout_id, version),
  KEY layout_id (layout_id),
  KEY created_by (created_by),
  CONSTRAINT layout_versions_layout_fk FOREIGN KEY (layout_id) REFERENCES document_layouts (id) ON DELETE CASCADE,
  CONSTRAINT layout_versions_created_by_fk FOREIGN KEY (created_by) REFERENCES employees (id) ON DELETE SET NULL
)
```

**Key Features:**
- Automatic version control for layout changes
- Change tracking with descriptions
- Cascade deletion when parent layout is deleted
- Version rollback capability

---

## Architecture Overview

### Frontend Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Layout Designer                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              LayoutDesigner.jsx                      │    │
│  │  - Main layout management component                 │    │
│  │  - Lists, creates, edits, deletes layouts          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│          ┌───────────────┴───────────────┐                 │
│          │                               │                 │
│  ┌───────▼────────┐            ┌────────▼────────┐        │
│  │ VisualBuilder  │            │   CodeEditor    │        │
│  │                │            │                 │        │
│  │ - XLSX Library │            │ - JSON Editor   │        │
│  │ - Excel-based  │            │ - JSON Config   │        │
│  │ - Cell editing │            │ - Validation    │        │
│  └────────────────┘            └─────────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Backend Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend Layout System                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              routes/layouts.js                       │    │
│  │  - RESTful API endpoints for layouts               │    │
│  │  - CRUD operations for layouts                      │    │
│  │  - Version management                              │    │
│  │  - Import/Export functionality                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MySQL Database                           │    │
│  │  - document_layouts table                            │    │
│  │  - layout_versions table                            │    │
│  │  - JSON storage for configurations                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Layout Workflow

```
1. Layout Creation
   User → LayoutDesigner → VisualBuilder/CodeEditor → XLSX/JSON → Backend API → MySQL

2. Layout Usage
   Document Generation → Layout Config → Render Preview → Print/Export

3. Layout Versioning
   Layout Update → New Version → layout_versions Table → Rollback Capability

4. Layout Import/Export
   Excel File → XLSX Library → Parse → Store as JSON → Export as Excel/JSON
```

### Key Integration Points

1. **Layout Designer ↔ Document Components**
   - Purchase Request components use layout configurations
   - Purchase Order components use layout configurations
   - Layout service provides active layout for each document type

2. **Excel Integration**
   - VisualBuilder uses XLSX library for Excel manipulation
   - Backend uses ExcelJS for Excel generation from layouts
   - Import/export functionality for Excel templates

3. **Real-time Updates**
   - Socket.io broadcasts layout changes to connected clients
   - Live preview updates when layouts are modified

4. **Security**
   - JWT authentication for layout access
   - Role-based access control for layout management
   - Input validation for layout configurations

---

## Library Summary Table

| Category | Library | Version | Purpose | Key Files |
|----------|---------|---------|---------|-----------|
| **Frontend Core** | React | 19.2.0 | UI Framework | All components |
| **Frontend Core** | React DOM | 19.2.0 | DOM Renderer | All components |
| **Frontend Core** | React Router DOM | 7.13.1 | Navigation | AppRoutes.jsx |
| **Layout Excel** | XLSX | 0.18.5 | Excel Layout Designer | VisualBuilder.jsx |
| **Frontend HTTP** | Axios | 1.13.5 | API Client | layouts.js |
| **Frontend Icons** | Lucide React | 0.563.0 | Icons | All components |
| **Frontend Styling** | Tailwind CSS | 4.1.18 | Styling | All components |
| **Frontend Charts** | Recharts | 3.7.0 | Data Visualization | Dashboard components |
| **Frontend Real-time** | Socket.io Client | 4.8.3 | WebSocket Client | Real-time features |
| **Backend Core** | Express.js | 4.18.2 | Web Framework | server.js |
| **Backend Database** | MySQL2 | 3.12.0 | Database Driver | database.js |
| **Backend Excel** | ExcelJS | 4.4.0 | Excel Generation | Export functionality |
| **Backend Real-time** | Socket.io | 4.8.3 | WebSocket Server | server.js |
| **Backend Auth** | jsonwebtoken | 9.0.2 | JWT Authentication | auth.js |
| **Backend Security** | Helmet | 8.1.0 | Security Headers | server.js |
| **Backend Validation** | express-validator | 7.0.1 | Input Validation | routes/layouts.js |
| **Backend Uploads** | Multer | 1.4.5-lts.1 | File Uploads | Layout import |

---

## Conclusion

This procurement system uses a comprehensive set of libraries to provide flexible document layout capabilities:

- **XLSX (SheetJS)** is the primary library for Excel-based layout design
- **Custom JSON configuration** provides an alternative layout approach
- **MySQL database** with JSON support stores layout configurations
- **ExcelJS** handles backend Excel generation for document exports
- **React ecosystem** provides the frontend interface for layout management
- **Express.js** provides the backend API for layout operations

The system supports multiple document types (purchase requests, purchase orders, payment requests, etc.) with customizable layouts, version control, and real-time collaboration features.