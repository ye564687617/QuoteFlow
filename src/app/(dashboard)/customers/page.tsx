import { CustomersManager } from "@/components/CustomersManager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export default async function CustomersPage(){const user=await requireUser();const customers=await db.customer.findMany({where:{archivedAt:null,...(user.role===UserRole.ADMIN?{}:{ownerId:user.id})},include:{owner:{select:{displayName:true}}},orderBy:{updatedAt:"desc"}});return <CustomersManager initialCustomers={JSON.parse(JSON.stringify(customers))} showOwner={user.role===UserRole.ADMIN}/>;}
