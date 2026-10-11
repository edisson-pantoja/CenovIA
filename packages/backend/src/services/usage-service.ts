import { createClient } from '@supabase/supabase-js';
import type { UserUsage } from '@cenovia/shared';
import config from '../config';

const supabase = createClient(
  config.supabaseUrl || '',
  config.supabaseServiceKey || ''
);

export type { UserUsage };

export class UsageService {
  static async getUserUsage(userId: string, month: string): Promise<UserUsage> {
    try {
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .single();

      const minutesUsed = data?.minutes_used || 0;
      const minutesRemaining = Math.max(0, config.freeTierMinutesPerMonth - minutesUsed);

      return {
        userId,
        month,
        minutesUsed,
        minutesLimit: config.freeTierMinutesPerMonth,
        minutesRemaining
      };
    } catch (error) {
      console.error('[USAGE] Error getting user usage:', error);
      return {
        userId,
        month,
        minutesUsed: 0,
        minutesLimit: config.freeTierMinutesPerMonth,
        minutesRemaining: config.freeTierMinutesPerMonth
      };
    }
  }

  static async incrementUsage(userId: string, minutes: number): Promise<void> {
    const month = new Date().toISOString().slice(0, 7);

    try {
      // Upsert atômico: evita race condition em sessões simultâneas
      // ON CONFLICT faz incremento direto no Postgres sem read-then-write
      const { error } = await supabase.rpc('increment_usage_minutes', {
        p_user_id: userId,
        p_month: month,
        p_minutes: minutes,
      });

      if (error) {
        // Fallback: soma manual caso a RPC não esteja disponível
        console.warn('[USAGE] RPC not available, using fallback upsert:', error.message);
        const currentUsage = await this.getUserUsage(userId, month);
        const newTotal = (currentUsage.minutesUsed || 0) + minutes;
        await supabase
          .from('usage_tracking')
          .upsert(
            { user_id: userId, month, minutes_used: newTotal },
            { onConflict: 'user_id,month', ignoreDuplicates: false }
          );
      }

      console.log(`[USAGE] Incremented ${minutes.toFixed(2)} min for user ${userId}`);
    } catch (error) {
      console.error('[USAGE] Error incrementing usage:', error);
    }
  }

  static async hasMinutesRemaining(userId: string): Promise<boolean> {
    const month = new Date().toISOString().slice(0, 7);
    const usage = await this.getUserUsage(userId, month);
    return usage.minutesRemaining > 0;
  }
}
