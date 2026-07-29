import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const existingUserCount = await db.user.count();
  if (existingUserCount > 0) {
    console.log(`Database already initialized with ${existingUserCount} user(s); skipping seed data.`);
    return;
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? "admin@quoteflow.local";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!";
  const salespersonEmail = process.env.INITIAL_SALESPERSON_EMAIL ?? "mandy@quoteflow.local";
  const salespersonPassword = process.env.INITIAL_SALESPERSON_PASSWORD ?? "ChangeMe123!";
  const adminPasswordHash = await hash(adminPassword, 12);
  const salespersonPasswordHash = await hash(salespersonPassword, 12);
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      displayName: process.env.INITIAL_ADMIN_NAME ?? "系统管理员",
      piPrefix: "Admin",
      role: UserRole.ADMIN,
    },
  });
  const mandy = await db.user.upsert({
    where: { email: salespersonEmail },
    update: {},
    create: {
      email: salespersonEmail,
      passwordHash: salespersonPasswordHash,
      displayName: process.env.INITIAL_SALESPERSON_NAME ?? "Mandy zang",
      piPrefix: "Mandy",
      role: UserRole.SALESPERSON,
    },
  });

  await db.companyProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      legalName: "SHIJI LIGHTING CO., LTD",
      plantAddress: "3F, Building A, Chuangfu Science and Technology Park, 202 Shihuan Road, Shiyan Street, Baoan District, Shenzhen, Guangdong, China. 518108",
      telephone: "0086 755-23125058",
      fax: "0086 755-2312-5658",
      mobile: "0086 13310852421",
      website: "www.shiji-led.com",
      email: "sales09@shiji-led.com",
      skype: "SHIJI LIGHTING Mandy",
      bankName: "PING AN BANK CO., LTD H. O. SHENZHEN",
      beneficiaryName: "SHIJI LIGHTING CO., LTD",
      beneficiaryAccount: "OSA 1500 0105 3420 97",
      swiftCode: "SZDBCNBS",
      bankAddress: "11/F, NO 5047 ROAD SHENNAN DONG, SHENZHEN, P. R. CHINA",
      companyAddress: "3F, Building A, Chuangfu Science and Technology Park, 202 Shihuan Road, Shiyan Street, Baoan District, Shenzhen, Guangdong, China",
      defaultDeliveryTerms: "3-15 working days upon receipt of the T/T copy",
      defaultPaymentTerms: "100% T/T before delivery",
      defaultProductionTime: "About 8-12 working days",
    },
  });

  const products = [
    ["SJ-IC30-2904RGBW-12V-UL", "30mm LED pixel light", "30mm diameter LED pixel light\n- 3 SMD 5050 RGBW LEDs\n- UCS2904, DC12V, 1.8W\n- Clear lens cover housing", "pcs", "Pixel lights"],
    ["SJ-UFO", "LED WiFi UFO Controller", "LED WiFi UFO Controller, RGBW", "pcs", "Controllers"],
    ["LRS-600-12", "600W power supply", "Non-waterproof power supply, 600W, DC12V", "pcs", "Power supplies"],
  ];
  for (const [pn, name, description, unit, category] of products) {
    await db.product.upsert({
      where: { pnNormalized: pn.trim().toUpperCase() },
      update: {},
      create: { pn, pnNormalized: pn.trim().toUpperCase(), name, description, unit, category },
    });
  }

  await db.customer.upsert({
    where: { id: "sample-customer" },
    update: {},
    create: {
      id: "sample-customer",
      ownerId: mandy.id,
      internalLabel: "Neon Moon Lighting",
      recipientName: "Jannyna Martinez",
      telephone: "713-887-9841",
      email: "directors@neonmoonlighting.com",
      shipTo: "17915 Mossforest Dr, Houston, TX 77090",
    },
  });

  console.log(`Seeded admin ${admin.email} and salesperson ${mandy.email}`);
}

main().finally(() => db.$disconnect());
