import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// 0️⃣ CONFIGURATION
// ---------------------------------------------------------------------------
const TAX_RATE = 0.18; // 18 %

// ---------------------------------------------------------------------------
// 1️⃣ CLI – retrieve the connection string
// ---------------------------------------------------------------------------
function getConnectionString(): string {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error(
            '\n❌ Expected exactly one argument – the PostgreSQL connection string.\n' +
            'Example:\n' +
            '  npx ts-node ./scripts/run-legacy-billing-migration.ts "postgresql://user:pass@host:5432/dbname"\n'
        );
        process.exit(1);
    }
    return args[0];
}

// ---------------------------------------------------------------------------
// 2️⃣ MAIN
// ---------------------------------------------------------------------------
async function main() {
    const connectionString = getConnectionString();

    const prisma = new PrismaClient({
        datasources: { db: { url: connectionString } },
        log: ['error', 'warn'],
    });

    console.log('🔎 Scanning for legacy BillingSnapshot records…');

    // -----------------------------------------------------------------------
    // 2a️⃣  Raw SQL – distinct snapshots (PostgreSQL)
    // -----------------------------------------------------------------------
    const rows = await prisma.$queryRaw<
        Array<{
            snapshot_id: string;
            result: string;
            inputs: any;
            sub_total_amount: number;
            tax_amount: number;
            tax_enabled: boolean | null;
            tax_percentage: number | null;
            cust_tax: boolean | null;
            cust_tds: boolean | null;
            cust_code: string | null;
            cust_name: string | null;
            cust_gstno: string | null;
            cust_tdsno: number | null;
            cust_address: string | null;
        }>
    >`
    SELECT DISTINCT ON (bs.id)
      bs.id            AS snapshot_id,
      bs."result"      AS result,
      bs.inputs        AS inputs,
      bs."subTotalAmount" AS sub_total_amount,
      bs."taxAmount"   AS tax_amount,
      bs."taxEnabled"  AS tax_enabled,
      bs."taxPercentage" AS tax_percentage,
      c."tax"          AS cust_tax,
      c."tds"          AS cust_tds,
      c."code"         AS cust_code,
      c."name"         AS cust_name,
      c."gstno"        AS cust_gstno,
      c."tdsno"        AS cust_tdsno,
      c."address"      AS cust_address
    FROM "BillingSnapshot" bs
    JOIN "BillingContext" bc
      ON bc.id = bs."billingContextId"
     AND bc.type = 'GROUP'
    JOIN "BillingContextOrder" bco
      ON bco."billingContextId" = bc.id
    JOIN "Order" o
      ON o.id = bco."orderId"
    JOIN "Customer" c
      ON c.id = o."customerId"
    WHERE (bs."subTotalAmount" = 0
           OR NOT (bs.inputs ? '__CUSTOMER_METADATA__'))
    ORDER BY bs.id;   -- required for DISTINCT ON
  `;

    console.log(`📦 Retrieved ${rows.length} unique snapshot(s) that need enrichment.`);

    // -----------------------------------------------------------------------
    // 2b️⃣ Process each snapshot
    // -----------------------------------------------------------------------
    for (const row of rows) {
        // Guard – sanity check that a customer really exists
        if (!row.cust_code) {
            console.warn(`⚠️  Snapshot ${row.snapshot_id} has no linked customer – skipping.`);
            continue;
        }

        // -------------------------------------------------
        // Build the __CUSTOMER_METADATA__ payload
        // -------------------------------------------------
        const customerMeta = {
            tax: row.cust_tax,
            tds: row.cust_tds,
            code: row.cust_code,
            name: row.cust_name,
            gstno: row.cust_gstno,
            tdsno: row.cust_tdsno,
            address: row.cust_address,
        };

        // -------------------------------------------------
        // Compute amounts (using the back‑out formula)
        // -------------------------------------------------
        const total = Number(row.result);               // gross amount stored
        const taxEnabled = Boolean(row.cust_tax);       // does the customer have tax?

        const subTotal = taxEnabled
            ? parseFloat((total / (1 + TAX_RATE)).toFixed(2))
            : total;

        const taxAmt = taxEnabled
            ? parseFloat((total - subTotal).toFixed(2))
            : 0;

        const taxPerc = taxEnabled ? TAX_RATE * 100 : 0;

        // -------------------------------------------------
        // Merge metadata into the existing inputs JSONB
        // -------------------------------------------------
        const existingInputs = row.inputs ?? {};
        const newInputs = {
            ...existingInputs,
            __CUSTOMER_METADATA__: customerMeta,
        };

        //console.log(newInputs);
        //console.log(customerMeta);
        //console.log(total);
        //console.log("tax ",taxEnabled);
        //console.log(subTotal);
        //console.log(taxAmt);
        //console.log(taxPerc);


        // -------------------------------------------------
        // Persist the changes
        // -------------------------------------------------
        //await prisma.billingSnapshot.update({
        //  where: { id: row.snapshot_id },
        //  data: {
        //    inputs: newInputs,
        //    finalAmount: total,
        //    subTotalAmount: subTotal,
        //    taxAmount: taxAmt,
        //    taxEnabled,
        //    taxPercentage: taxPerc,
        //  },
        //});

        console.log(`✅  Updated snapshot ${row.snapshot_id}`);
    }

    console.log('\n🎉 Migration completed successfully.');
    await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// 3️⃣ Run
// ---------------------------------------------------------------------------
main().catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
});