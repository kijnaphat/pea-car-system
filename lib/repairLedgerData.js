import { supabase } from './supabaseClient'
import { createRepairLedgerClient } from './repairLedgerApi'

export const {
  getRepairLedgerAccess, getRepairLedgerIdentity, verifyRepairLedgerStaff,
  clearRepairLedgerIdentity, watchRepairLedgerIdentity, loadRepairLedger, saveRepairLedger,
} = createRepairLedgerClient(supabase)
