export type User = { id: string; name: string; email: string; role: 'admin' | 'employee'; phone: string; active: boolean };
export type Payment = { id: string; customer: string; amount_paise: number; method: string; status: 'paid' | 'pending'; reference: string; notes: string; employee_name: string; refunded_paise: number; created_at: string };
export type Refund = { id: string; customer: string; amount_paise: number; reason: string; employee_name: string; status: 'pending' | 'approved' | 'rejected' };
export type Dashboard = { paid_paise: number; pending_paise: number; refunded_paise: number; net_paise: number; count: number };
export type Audit = { id: number; actor_name: string; action: string; entity_id: string; created_at: string };
export type GoRecord = { id: string; go_date: string; tons: number; price_per_ton_paise: number; sales_paise: number; amount_received_paise: number; received_date: string | null; outstanding_paise: number; employee_name: string; created_at: string };
