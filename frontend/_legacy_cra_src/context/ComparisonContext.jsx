import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '../hooks/use-toast';

const ComparisonContext = createContext();

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within ComparisonProvider');
  }
  return context;
};

export const ComparisonProvider = ({ children }) => {
  const { toast } = useToast();
  const [comparisonList, setComparisonList] = useState(() => {
    const saved = localStorage.getItem('oceanBazarComparison');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('oceanBazarComparison', JSON.stringify(comparisonList));
  }, [comparisonList]);

  const addToComparison = (product) => {
    const pid = product?.id ?? product?._id;
    if (!pid) return false;

    const normalized = { ...product, id: String(pid) };
    if (comparisonList.length >= 4) {
      toast({
        title: 'Comparison Limit Reached',
        description: 'You can compare up to 4 products at a time',
        variant: 'destructive'
      });
      return false;
    }

    if (comparisonList.find((p) => p?.id === String(pid))) {
      toast({
        title: 'Already in Comparison',
        description: 'This product is already in your comparison list',
        variant: 'destructive'
      });
      return false;
    }

    setComparisonList([...comparisonList, normalized]);
    toast({
      title: 'Added to Comparison',
      description: `${normalized.name || 'Product'} added to comparison list`
    });
    return true;
  };

  const removeFromComparison = (productId) => {
    setComparisonList(comparisonList.filter(p => p.id !== productId));
    toast({
      title: 'Removed from Comparison',
      description: 'Product removed from comparison list'
    });
  };

  const clearComparison = () => {
    setComparisonList([]);
    localStorage.removeItem('oceanBazarComparison');
  };

  return (
    <ComparisonContext.Provider value={{
      comparisonList,
      addToComparison,
      removeFromComparison,
      clearComparison,
      comparisonCount: comparisonList.length
    }}>
      {children}
    </ComparisonContext.Provider>
  );
};
