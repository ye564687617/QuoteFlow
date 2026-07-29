import { UsersManager } from "@/components/UsersManager";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function UsersPage(){await requireAdmin();const users=await db.user.findMany({select:{id:true,email:true,displayName:true,piPrefix:true,role:true,active:true},orderBy:{createdAt:"asc"}});return <UsersManager initialUsers={users}/>;}
