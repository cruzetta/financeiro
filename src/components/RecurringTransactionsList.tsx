import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Calendar, DollarSign, Tag, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { deleteRecurringTransaction } from '../lib/recurringTransactions';
import { RecurringTransactionForm } from './RecurringTransactionForm';
import type { RecurringTransaction } from '../types';

export function RecurringTransactionsList() {
  const { user } = useAuth();
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | undefined>();
  const [deleteModal, setDeleteModal] = useState<{
    transaction: RecurringTransaction;
    effectiveDate: string;
    showDatePicker: boolean;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadRecurringTransactions();
    }
  }, [user]);

  const loadRecurringTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecurringTransactions(data || []);
    } catch (error) {
      console.error('Erro ao carregar atalhos fixos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = async (transaction: RecurringTransaction, effectiveDate?: string) => {
    try {
      const effectiveFromDate = effectiveDate ? new Date(effectiveDate) : new Date();
      await deleteRecurringTransaction(transaction.id, effectiveFromDate);
      await loadRecurringTransactions();
      setDeleteModal(null);
    } catch (error) {
      console.error('Erro ao excluir atalho fixo:', error);
      alert('Erro ao excluir atalho fixo. Tente novamente.');
    }
  };

  const openDeleteModal = (transaction: RecurringTransaction) => {
    const today = new Date().toISOString().split('T')[0];
    setDeleteModal({
      transaction,
      effectiveDate: today,
      showDatePicker: false
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTransaction(undefined);
    loadRecurringTransactions();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTransaction(undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Atalhos Fixos</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Atalho</span>
        </button>
      </div>

      {recurringTransactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Nenhum atalho fixo cadastrado</p>
          <p className="text-sm">Crie atalhos para receitas e despesas recorrentes</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {recurringTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-gray-900">
                      {transaction.description}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4" />
                      <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Tag className="w-4 h-4" />
                      <span>{transaction.category}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Todo dia {transaction.day_of_month}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(transaction)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => openDeleteModal(transaction)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RecurringTransactionForm
          recurringTransaction={editingTransaction}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Excluir Atalho Fixo
              </h3>
              
              <p className="text-gray-600 mb-4">
                Tem certeza que deseja excluir o atalho "{deleteModal.transaction.description}"?
              </p>

              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="showDeleteDate"
                    checked={deleteModal.showDatePicker}
                    onChange={(e) => setDeleteModal({
                      ...deleteModal,
                      showDatePicker: e.target.checked
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showDeleteDate" className="text-sm text-gray-700">
                    Excluir apenas a partir de uma data específica
                  </label>
                </div>

                {deleteModal.showDatePicker && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data efetiva da exclusão
                    </label>
                    <input
                      type="date"
                      value={deleteModal.effectiveDate}
                      onChange={(e) => setDeleteModal({
                        ...deleteModal,
                        effectiveDate: e.target.value
                      })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Transações anteriores a esta data permanecerão inalteradas.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(
                    deleteModal.transaction,
                    deleteModal.showDatePicker ? deleteModal.effectiveDate : undefined
                  )}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}