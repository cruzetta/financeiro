import { supabase } from './supabase';
import type { Transaction, RecurringTransaction } from '../types';

export async function generateRecurringTransactions(
  recurringTransaction: RecurringTransaction,
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    // Verifica se já existe uma transação para este mês
    const existingTransaction = await checkExistingTransaction(
      recurringTransaction.id,
      current
    );
    
    if (!existingTransaction) {
      // Criar data específica para o dia do mês
      const transactionDate = new Date(
        current.getFullYear(), 
        current.getMonth(), 
        recurringTransaction.day_of_month,
        12, 0, 0, 0 // Meio-dia para evitar problemas de fuso horário
      );
      
      // Verificar se o dia existe no mês (ex: 31 de fevereiro)
      if (transactionDate.getMonth() !== current.getMonth()) {
        // Se o dia não existe, usar o último dia do mês
        transactionDate.setMonth(current.getMonth() + 1, 0);
      }
      
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        description: recurringTransaction.description,
        amount: recurringTransaction.amount,
        type: recurringTransaction.type,
        category: recurringTransaction.category,
        date: transactionDate,
        status: 'pending',
        recurring_transaction_id: recurringTransaction.id,
        user_id: recurringTransaction.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      transactions.push(transaction);
    }
    
    // Avança para o próximo mês
    current.setMonth(current.getMonth() + 1);
  }
  
  return transactions;
}

async function checkExistingTransaction(
  recurringTransactionId: string,
  date: Date
): Promise<boolean> {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('recurring_transaction_id', recurringTransactionId)
    .gte('date', startOfMonth.toISOString())
    .lte('date', endOfMonth.toISOString())
    .limit(1);
  
  if (error) {
    console.error('Erro ao verificar transação existente:', error);
    return false;
  }
  
  return data && data.length > 0;
}

export async function updateRecurringTransaction(
  id: string,
  updates: Partial<RecurringTransaction>,
  effectiveFromDate?: Date
): Promise<void> {
  try {
    const effectiveDate = effectiveFromDate || new Date();
    
    // 1. Atualiza o atalho fixo
    const { error: updateError } = await supabase
      .from('recurring_transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      throw updateError;
    }
    
    // 2. Remove transações futuras pendentes a partir da data efetiva
    await removeFuturePendingTransactions(id, effectiveDate);
    
    // 3. Busca o atalho atualizado
    const { data: recurringTransaction, error: fetchError } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !recurringTransaction) {
      throw fetchError || new Error('Atalho fixo não encontrado');
    }
    
    // 4. Gera novas transações futuras com os valores atualizados
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2); // Gera para os próximos 2 anos
    
    const newTransactions = await generateRecurringTransactions(
      recurringTransaction,
      effectiveDate,
      endDate
    );
    
    // 5. Insere as novas transações
    if (newTransactions.length > 0) {
      const transactionsToInsert = newTransactions.map(t => ({
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        date: t.date.toISOString(),
        status: t.status,
        recurring_transaction_id: t.recurring_transaction_id,
        user_id: t.user_id
      }));
      
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);
      
      if (insertError) {
        throw insertError;
      }
    }
    
  } catch (error) {
    console.error('Erro ao atualizar transação recorrente:', error);
    throw error;
  }
}

export async function deleteRecurringTransaction(
  id: string,
  effectiveFromDate?: Date
): Promise<void> {
  try {
    const effectiveDate = effectiveFromDate || new Date();
    
    // 1. Remove transações futuras pendentes a partir da data efetiva
    await removeFuturePendingTransactions(id, effectiveDate);
    
    // 2. Se a data efetiva é hoje ou no passado, desativa o atalho
    // Se é no futuro, mantém o atalho ativo até a data especificada
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    effectiveDate.setHours(0, 0, 0, 0);
    
    if (effectiveDate <= today) {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
    } else {
      // Para exclusões futuras, podemos implementar uma data de fim
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ 
          end_date: effectiveDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Erro ao excluir transação recorrente:', error);
    throw error;
  }
}

async function removeFuturePendingTransactions(
  recurringTransactionId: string,
  fromDate: Date
): Promise<void> {
  // Remove apenas transações futuras que estão pendentes
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('recurring_transaction_id', recurringTransactionId)
    .eq('status', 'pending')
    .gte('date', fromDate.toISOString());
  
  if (error) {
    console.error('Erro ao remover transações futuras:', error);
    throw error;
  }
}

export async function processRecurringTransactions(): Promise<void> {
  try {
    // Busca todos os atalhos ativos
    const { data: recurringTransactions, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    if (!recurringTransactions || recurringTransactions.length === 0) {
      return;
    }
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    
    for (const recurring of recurringTransactions) {
      // Verifica se há uma data de fim definida
      const endDate = recurring.end_date ? new Date(recurring.end_date) : futureDate;
      
      // Gera transações apenas até a data de fim (se definida)
      const transactions = await generateRecurringTransactions(
        recurring,
        today,
        endDate
      );
      
      if (transactions.length > 0) {
        const transactionsToInsert = transactions.map(t => ({
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category,
          date: t.date.toISOString(),
          status: t.status,
          recurring_transaction_id: t.recurring_transaction_id,
          user_id: t.user_id
        }));
        
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);
        
        if (insertError) {
          console.error('Erro ao inserir transações recorrentes:', insertError);
        }
      }
    }
    
  } catch (error) {
    console.error('Erro ao processar transações recorrentes:', error);
  }
}

// Função para verificar e corrigir inconsistências
export async function validateRecurringTransactions(): Promise<void> {
  try {
    const { data: recurringTransactions, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('is_active', true);
    
    if (error || !recurringTransactions) {
      return;
    }
    
    for (const recurring of recurringTransactions) {
      // Verifica se existem transações duplicadas para o mesmo mês
      const { data: duplicates, error: duplicatesError } = await supabase
        .from('transactions')
        .select('id, date')
        .eq('recurring_transaction_id', recurring.id)
        .order('date');
      
      if (duplicatesError || !duplicates) {
        continue;
      }
      
      // Agrupa por mês/ano e remove duplicatas
      const monthGroups = new Map<string, string[]>();
      
      for (const transaction of duplicates) {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        
        if (!monthGroups.has(monthKey)) {
          monthGroups.set(monthKey, []);
        }
        monthGroups.get(monthKey)!.push(transaction.id);
      }
      
      // Remove duplicatas (mantém apenas a primeira de cada mês)
      for (const [monthKey, transactionIds] of monthGroups) {
        if (transactionIds.length > 1) {
          const toRemove = transactionIds.slice(1); // Remove todas exceto a primeira
          
          await supabase
            .from('transactions')
            .delete()
            .in('id', toRemove);
        }
      }
    }
    
  } catch (error) {
    console.error('Erro ao validar transações recorrentes:', error);
  }
}

// Função para limpar duplicatas existentes
export async function cleanupDuplicateTransactions(userId: string): Promise<void> {
  try {
    // Buscar todas as transações do usuário ordenadas por data
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, date, recurring_transaction_id, description, amount')
      .eq('user_id', userId)
      .not('recurring_transaction_id', 'is', null)
      .order('date');
    
    if (error || !transactions) {
      return;
    }
    
    // Agrupar por recurring_transaction_id e mês/ano
    const groups = new Map<string, Map<string, string[]>>();
    
    for (const transaction of transactions) {
      const recurringId = transaction.recurring_transaction_id!;
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!groups.has(recurringId)) {
        groups.set(recurringId, new Map());
      }
      
      const monthGroups = groups.get(recurringId)!;
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, []);
      }
      
      monthGroups.get(monthKey)!.push(transaction.id);
    }
    
    // Remover duplicatas
    for (const [recurringId, monthGroups] of groups) {
      for (const [monthKey, transactionIds] of monthGroups) {
        if (transactionIds.length > 1) {
          // Manter apenas a primeira transação, remover as outras
          const toRemove = transactionIds.slice(1);
          
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .in('id', toRemove);
          
          if (deleteError) {
            console.error('Erro ao remover duplicatas:', deleteError);
          } else {
            console.log(`Removidas ${toRemove.length} duplicatas para ${recurringId} no mês ${monthKey}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Erro ao limpar duplicatas:', error);
  }
}