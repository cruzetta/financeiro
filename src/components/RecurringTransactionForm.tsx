import React, { useState } from 'react';
import { Calendar, DollarSign, Tag, Type, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { updateRecurringTransaction } from '../lib/recurringTransactions';
import type { RecurringTransaction } from '../types';

interface RecurringTransactionFormProps {
  recurringTransaction?: RecurringTransaction;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RecurringTransactionForm({ 
  recurringTransaction, 
  onSuccess, 
  onCancel 
}: RecurringTransactionFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [showEffectiveDate, setShowEffectiveDate] = useState(false);
  
  const [formData, setFormData] = useState({
    description: recurringTransaction?.description || '',
    amount: recurringTransaction?.amount || 0,
    type: recurringTransaction?.type || 'expense' as 'income' | 'expense',
    category: recurringTransaction?.category || '',
    day_of_month: recurringTransaction?.day_of_month || 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      if (recurringTransaction) {
        // Edição - verifica se deve aplicar a partir de uma data específica
        const effectiveFromDate = showEffectiveDate && effectiveDate 
          ? new Date(effectiveDate) 
          : new Date();
        
        await updateRecurringTransaction(
          recurringTransaction.id,
          {
            description: formData.description,
            amount: formData.amount,
            type: formData.type,
            category: formData.category,
            day_of_month: formData.day_of_month,
          },
          effectiveFromDate
        );
      } else {
        // Criação
        const { error } = await supabase
          .from('recurring_transactions')
          .insert({
            description: formData.description,
            amount: formData.amount,
            type: formData.type,
            category: formData.category,
            day_of_month: formData.day_of_month,
            user_id: user.id,
            is_active: true,
          });

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar atalho fixo:', error);
      alert('Erro ao salvar atalho fixo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {recurringTransaction ? 'Editar Atalho Fixo' : 'Novo Atalho Fixo'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <div className="relative">
                <Type className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Aluguel do escritório"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Moradia, Alimentação"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia do mês
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>
                      Dia {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {recurringTransaction && (
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="showEffectiveDate"
                    checked={showEffectiveDate}
                    onChange={(e) => setShowEffectiveDate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showEffectiveDate" className="text-sm text-gray-700">
                    Aplicar alterações a partir de uma data específica
                  </label>
                </div>

                {showEffectiveDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data efetiva
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        min={today}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={showEffectiveDate}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      As alterações serão aplicadas apenas a partir desta data. 
                      Transações anteriores permanecerão inalteradas.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}