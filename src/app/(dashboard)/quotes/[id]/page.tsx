import { QuoteEditor } from "@/components/QuoteEditor";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQuoteRevision, serializeRevision } from "@/lib/quotes";
import { isMandy, MANDY_COMPLETION_MESSAGES, pickMandyMessage } from "@/lib/mandy-messages";
import { QuoteRevision } from "@/types";

export default async function QuotePage({params}:{params:Promise<{id:string}>}){const user=await requireUser();const{id}=await params;const[revision,products]=await Promise.all([getQuoteRevision(id,user),db.product.findMany({where:{archivedAt:null},include:{assets:{where:{isPrimary:true},take:1}},orderBy:{pnNormalized:"asc"}})]);const completionMessage=isMandy(user)?pickMandyMessage(MANDY_COMPLETION_MESSAGES,revision.displayPiNumber):null;return <QuoteEditor initialRevision={serializeRevision(revision) as unknown as QuoteRevision} products={JSON.parse(JSON.stringify(products))} completionMessage={completionMessage}/>;}
