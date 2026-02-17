import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 20,
        fontSize: 10,
        fontFamily: 'Helvetica',
        flexDirection: 'column',
    },
    header: {
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    companyInfo: {
        marginBottom: 10,
        textAlign: 'center',
    },
    companyName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    companyAddress: {
        fontSize: 9,
        marginBottom: 2,
    },
    billInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    billTo: {
        width: '50%',
    },
    billDetails: {
        width: '45%',
        alignItems: 'flex-end',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 5,
        textDecoration: 'underline',
    },
    table: {
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#000',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    colSrNo: { width: '8%', textAlign: 'center', paddingHorizontal: 5 },
    colOrderCode: { width: '22%', textAlign: 'center', paddingHorizontal: 5 },
    colQuantity: { width: '15%', textAlign: 'center', paddingHorizontal: 5 },
    colRate: { width: '25%', textAlign: 'center', paddingHorizontal: 5 },
    colAmount: { width: '30%', textAlign: 'center', paddingHorizontal: 5 },
    totalsContainer: {
        marginTop: 10,
        alignSelf: 'flex-end',
        width: '50%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        paddingHorizontal: 10,
    },
    totalLabel: {
        textAlign: 'left',
        fontWeight: 'bold',
    },
    totalValue: {
        textAlign: 'right',
        minWidth: 80,
    },
    grandTotalRow: {
        borderTopWidth: 1,
        borderTopColor: '#000',
        paddingTop: 6,
        marginTop: 6,
        fontWeight: 'bold',
        fontSize: 11,
    },
    amountInWords: {
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    amountInWordsTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    footer: {
        marginTop: 30,
        textAlign: 'center',
        fontSize: 9,
        color: '#666',
        fontStyle: 'italic',
    },
});

interface InvoiceItem {
    srNo: number;
    orderCode: string;
    quantity: number;
    rate: string;
    amount: string;
}

interface InvoiceData {
    heading: string;
    companyName: string;
    companyAddress: string;
    msmeReg: string;
    gstin: string;
    billTo: string;
    address: string;
    date: string;
    billNumber: string;
    items: InvoiceItem[];
    subtotal: string;
    cgstAmount: string;
    sgstAmount: string;
    tdsAmount: string;
    tdsRate: string;
    total: string;
}

interface InvoicePDFProps {
    invoiceData: InvoiceData;
}

// Function to convert number to words in Indian numbering system
const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = Math.floor((num % 1000) / 100);
    const remainder = num % 100;

    let words = '';

    if (crore > 0) {
        words += numberToWords(crore) + ' Crore ';
    }

    if (lakh > 0) {
        words += numberToWords(lakh) + ' Lakh ';
    }

    if (thousand > 0) {
        words += numberToWords(thousand) + ' Thousand ';
    }

    if (hundred > 0) {
        words += numberToWords(hundred) + ' Hundred ';
    }

    if (remainder > 0) {
        if (words !== '') words += 'and ';

        if (remainder < 10) {
            words += ones[remainder];
        } else if (remainder < 20) {
            words += teens[remainder - 10];
        } else {
            words += tens[Math.floor(remainder / 10)];
            if (remainder % 10 > 0) {
                words += ' ' + ones[remainder % 10];
            }
        }
    }

    return words.trim();
};

const InvoicePDF = ({ invoiceData }: InvoicePDFProps) => {
    const totalNumber = parseFloat(invoiceData.total);
    const roundedTotal = Math.round(totalNumber * 100) / 100; // Round to 2 decimal places

    return (
        <Document>
            <Page size="A4" orientation="landscape" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{invoiceData.heading}</Text>

                    <View style={styles.companyInfo}>
                        <Text style={styles.companyName}>{invoiceData.companyName}</Text>
                        <Text style={styles.companyAddress}>{invoiceData.companyAddress}</Text>
                        <Text style={styles.companyAddress}>{invoiceData.msmeReg}</Text>
                        <Text style={styles.companyAddress}>GSTIN: 27AEDFS7100N1ZT</Text>
                    </View>
                </View>

                {/* Bill To and Details */}
                <View style={styles.billInfoContainer}>
                    <View style={styles.billTo}>
                        <Text style={styles.sectionTitle}>Bill to:</Text>
                        <Text>{invoiceData.billTo}</Text>
                        <Text>ADDRESS: {invoiceData.address}</Text>
                        <Text>GST NO: {invoiceData.gstin}</Text>
                    </View>

                    <View style={styles.billDetails}>
                        <Text style={styles.sectionTitle}>Bill Details</Text>
                        <Text>Date: {invoiceData.date}</Text>
                        <Text>Bill#: {invoiceData.billNumber}</Text>
                        <Text>HSM/SL: 998822</Text>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSrNo}>#</Text>
                        <Text style={styles.colOrderCode}>Order Code</Text>
                        <Text style={styles.colQuantity}>Quantity</Text>
                        <Text style={styles.colRate}>Rate</Text>
                        <Text style={styles.colAmount}>Amount</Text>
                    </View>

                    {/* Table Rows */}
                    {invoiceData.items.map((item) => (
                        <View key={item.srNo} style={styles.tableRow}>
                            <Text style={styles.colSrNo}>{item.srNo}</Text>
                            <Text style={styles.colOrderCode}>{item.orderCode}</Text>
                            <Text style={styles.colQuantity}>{item.quantity}</Text>
                            <Text style={styles.colRate}>{parseFloat(item.rate).toFixed(2)}</Text>
                            <Text style={styles.colAmount}>{parseFloat(item.amount).toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totals */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Sub Total:</Text>
                        <Text style={styles.totalValue}>{parseFloat(invoiceData.subtotal).toFixed(2)}</Text>
                    </View>

                    {parseFloat(invoiceData.cgstAmount) > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>CGST (2.5%):</Text>
                            <Text style={styles.totalValue}>{invoiceData.cgstAmount}</Text>
                        </View>
                    )}

                    {parseFloat(invoiceData.sgstAmount) > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>SGST (2.5%):</Text>
                            <Text style={styles.totalValue}>{invoiceData.sgstAmount}</Text>
                        </View>
                    )}

                    {parseFloat(invoiceData.tdsAmount) > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>TDS ({invoiceData.tdsRate}%):</Text>
                            <Text style={styles.totalValue}>{invoiceData.tdsAmount}</Text>
                        </View>
                    )}

                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>{roundedTotal.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Amount in Words */}
                <View style={styles.amountInWords}>
                    <Text style={styles.amountInWordsTitle}>Total in Words:</Text>
                    <Text>{(() => {
                        const integerPart = Math.floor(roundedTotal);
                        const decimalPart = Math.round((roundedTotal - integerPart) * 100);

                        let text = `${numberToWords(integerPart)} Rupees`;

                        if (decimalPart > 0) {
                            text += ` and ${numberToWords(decimalPart)} Paisa`;
                        } else {
                            text += ` and No Paisa`;
                        }

                        return text;
                    })()}</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Thank You! It was a privilege to do business with you, and it would be our pleasure to continue serving you.</Text>
                </View>
            </Page>
        </Document>
    );
};

export default InvoicePDF;