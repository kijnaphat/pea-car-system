import { supabase } from './supabaseClient'
import { createRepairLedgerClient } from './repairLedgerApi'

export const { getRepairLedgerAccess, loadRepairLedger, saveRepairLedger } = createRepairLedgerClient(supabase)

export function watchRepairLedgerAccess(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user?.app_metadata?.role === 'admin')
  })
  return () => data.subscription.unsubscribe()
}
