const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;
    for (const [search, replace] of replacements) {
        if (content.includes(search)) {
            content = content.replace(search, replace);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
    }
}

// Approvals.jsx
replaceInFile('src/components/approvals/Approvals.jsx', [
    ['const [isMobile, setIsMobile] = useState(false);', ''],
]);

// PaymentRequests.jsx
replaceInFile('src/components/PaymentRequests.jsx', [
    ['catch (err)', 'catch (error)'],
    ['console.error(err)', 'console.error(error)'],
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', ''],
]);

// PaymentOrders.jsx
replaceInFile('src/components/PaymentOrders.jsx', [
    ['catch (err)', 'catch (error)'],
    ['console.error(err)', 'console.error(error)'],
    ['const { formatDate } = useUtils()', 'const {} = useUtils()'],
]);

// Dashboard.jsx
replaceInFile('src/components/Dashboard.jsx', [
    ['const StatCard = ({ title, value, type, Icon }) => (', 'const StatCard = ({ title, value, type }) => ('],
    ['fetchPricingTrends()', 'fetchPricingTrends()'],
]);

// ServiceRequestsManagement.jsx
replaceInFile('src/components/service-requests/ServiceRequestsManagement.jsx', [
    ['const [showDetailModal, setShowDetailModal] = useState(false)', ''],
    ['const [selectedSR, setSelectedSR] = useState(null)', ''],
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', ''],
    ['catch (err)', 'catch (error)'],
    ['console.error(err)', 'console.error(error)']
]);

// PRTable.jsx
replaceInFile('src/components/purchase-requests/PRTable.jsx', [
    ['const handleCancelPR', '// const handleCancelPR'],
    ['purchaseRequestService', '// purchaseRequestService'],
    ['setExpandedPRDetails', '// setExpandedPRDetails']
]);

// PendingPurchaseRequests.jsx
replaceInFile('src/components/purchase-requests/PendingPurchaseRequests.jsx', [
    ['const { formatDate } = useUtils()', 'const {} = useUtils()'],
    ['const { user } = useAuth()', 'const {} = useAuth()'],
    ['catch (err)', 'catch (error)'],
    ['console.error(err)', 'console.error(error)']
]);

// PurchaseRequests.jsx
replaceInFile('src/components/purchase-requests/PurchaseRequests.jsx', [
    ['const { formatDate, formatPaymentTerms } = useUtils()', 'const {} = useUtils()'],
    ['const [showPreviewModal, setShowPreviewModal] = useState(false)', ''],
    ['catch (err)', 'catch (error)'],
    ['console.error(err)', 'console.error(error)']
]);

// SRPreviewModal.jsx
replaceInFile('src/components/service-requests/SRPreviewModal.jsx', [
    ['const [loading, setLoading] = useState(true)', ''],
]);

// ServiceRequestApproval.jsx
replaceInFile('src/components/service-requests/ServiceRequestApproval.jsx', [
    ['const { user } = useAuth()', 'const {} = useAuth()']
]);

console.log('Replacements done');
