import { CompanyForm } from "@/components/CompanyForm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CompanyPage(){await requireAdmin();const company=await db.companyProfile.findUnique({where:{id:"default"}});return <CompanyForm initialCompany={JSON.parse(JSON.stringify(company))}/>;}
