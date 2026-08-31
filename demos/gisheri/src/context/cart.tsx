import { createContext, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '@/data/products';

export type CartItem = {
  product: Product;
  size: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; size: string; quantity: number }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_QUANTITY'; itemId: string; quantity: number }
  | { type: 'UPDATE_SIZE'; itemId: string; size: string }
  | { type: 'CLEAR' };

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (product: Product, size: string, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateSize: (itemId: string, size: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

/**
 * Upstream this rehydrated the cart from a `localStorage` key, and a matching
 * effect wrote it back on every change. Both ends are gone: the demo keeps its
 * state in memory for the life of the tab, and the only Web Storage key it is
 * allowed is the language preference.
 *
 * The seam is left as a function rather than inlined as `{ items: [] }` because
 * this is precisely where persistence goes back if it ever should, and because
 * a reader who reaches for the cart's storage key deserves to find the reason
 * it is not there.
 */
const loadCartItems = (): CartItem[] => [];

const getItemId = (productId: string, size: string) => `${productId}:${size}`;

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const itemId = getItemId(action.product.id, action.size);
      const existing = state.items.find(
        (item) => getItemId(item.product.id, item.size) === itemId,
      );
      if (existing) {
        return {
          items: state.items.map((item) =>
            getItemId(item.product.id, item.size) === itemId
              ? { ...item, quantity: item.quantity + action.quantity }
              : item,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { product: action.product, size: action.size, quantity: action.quantity },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (item) => getItemId(item.product.id, item.size) !== action.itemId,
        ),
      };
    case 'UPDATE_QUANTITY':
      return {
        items: state.items.map((item) =>
          getItemId(item.product.id, item.size) === action.itemId
            ? { ...item, quantity: Math.max(1, action.quantity) }
            : item,
        ),
      };
    case 'UPDATE_SIZE': {
      const target = state.items.find((item) => getItemId(item.product.id, item.size) === action.itemId);
      if (!target) {
        return state;
      }
      if (target.size === action.size) {
        return state;
      }
      const nextItemId = getItemId(target.product.id, action.size);
      const existing = state.items.find((item) => getItemId(item.product.id, item.size) === nextItemId);
      const withoutTarget = state.items.filter((item) => getItemId(item.product.id, item.size) !== action.itemId);
      if (existing) {
        return {
          items: withoutTarget.map((item) =>
            getItemId(item.product.id, item.size) === nextItemId
              ? { ...item, quantity: item.quantity + target.quantity }
              : item,
          ),
        };
      }
      return {
        items: [
          ...withoutTarget,
          { ...target, size: action.size },
        ],
      };
    }
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] }, () => ({
    items: loadCartItems(),
  }));

  const addItem = (product: Product, size: string, quantity = 1) => {
    dispatch({ type: 'ADD_ITEM', product, size, quantity });
  };

  const removeItem = (itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', itemId });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', itemId, quantity });
  };

  const updateSize = (itemId: string, size: string) => {
    dispatch({ type: 'UPDATE_SIZE', itemId, size });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR' });
  };

  const totalItems = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items],
  );

  const subtotal = useMemo(
    () => state.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [state.items],
  );

  const value = useMemo(
    () => ({
      items: state.items,
      totalItems,
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      updateSize,
      clearCart,
    }),
    [state.items, totalItems, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
