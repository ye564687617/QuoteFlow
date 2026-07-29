import { UserRole } from "@prisma/client";
import { QuotesManager } from "@/components/QuotesManager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { shanghaiDateParts } from "@/lib/dates";
import { isMandy, MANDY_WARM_MESSAGES, pickMandyMessage } from "@/lib/mandy-messages";
import { serializeRevision } from "@/lib/quotes";

export default async function QuotesPage(){const user=await requireUser();const[revisions,customers]=await Promise.all([db.quoteRevision.findMany({where:user.role===UserRole.ADMIN?{}:{series:{salespersonId:user.id}},include:{series:{include:{salesperson:{select:{displayName:true}},customer:{select:{internalLabel:true}}}},exportJob:true,_count:{select:{items:true}}},orderBy:{updatedAt:"desc"},take:200}),db.customer.findMany({where:{archivedAt:null,...(user.role===UserRole.ADMIN?{}:{ownerId:user.id})},orderBy:{internalLabel:"asc"}})]);const warmMessage=isMandy(user)?pickMandyMessage(MANDY_WARM_MESSAGES,`${user.id}:${shanghaiDateParts().compact}`):null;return <QuotesManager initialRevisions={serializeRevision(revisions) as unknown as React.ComponentProps<typeof QuotesManager>["initialRevisions"]} customers={JSON.parse(JSON.stringify(customers))} warmMessage={warmMessage}/>;}
