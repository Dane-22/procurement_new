const fs = require('fs');
const path = require('path');

const replacements = {
  'src/components/Dashboard.jsx': [
    ['const StatCard = ({ title, value, type, Icon }) => (', 'const StatCard = ({ title, value, type }) => (']
  ],
  'src/components/employees/Employees.jsx': [
    ['const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)', '']
  ],
  'src/components/items/Items.jsx': [
    ['const [expandedItemId, setExpandedItemId] = useState(null)', '']
  ],
  'src/components/order-numbers/OrderNumbers.jsx': [
    ['const navigate = useNavigate()', '']
  ],
  'src/components/payment-requests/PaymentRequestPreviewModal.jsx': [
    ['loading', '_loading']
  ],
  'src/components/purchase-orders/PurchaseOrders.jsx': [
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', ''],
    ['const [openEditModal, setOpenEditModal] = useState(false)', '']
  ],
  'src/components/purchase-requests/PRTable.jsx': [
    ['handleCancelPR', '_handleCancelPR'],
    ['purchaseRequestService', '_purchaseRequestService'],
    ['setExpandedPRDetails', '_setExpandedPRDetails']
  ],
  'src/components/purchase-requests/PendingPurchaseRequests.jsx': [
    ['const { formatDate } = useUtils()', 'const {} = useUtils()'],
    ['const { user } = useAuth()', 'const {} = useAuth()']
  ],
  'src/components/purchase-requests/PurchaseRequests.jsx': [
    ['const { formatDate, formatPaymentTerms } = useUtils()', 'const {} = useUtils()'],
    ['const [setExpandedPRDetails] = useState(null)', ''],
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', '']
  ],
  'src/components/service-requests/SRPreviewModal.jsx': [
    ['loading', '_loading']
  ],
  'src/components/service-requests/ServiceRequestApproval.jsx': [
    ['const { user } = useAuth()', 'const {} = useAuth()']
  ],
  'src/components/service-requests/ServiceRequestsManagement.jsx': [
    ['const [showDetailModal, setShowDetailModal] = useState(false)', ''],
    ['const [selectedSR, setSelectedSR] = useState(null)', ''],
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', '']
  ],
  'src/services/notifications.js': [
    ['\\-', '-']
  ]
};

for (const [file, reps] of Object.entries(replacements)) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;
    for (const [search, replace] of reps) {
        if (content.includes(search)) {
            content = content.replace(search, replace);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
    }
}
console.log('Fixed simple errors');
