// pages/index.js
import styles from '../styles/Loading.module.css';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { db } from '../lib/firebase'
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [newStore, setNewStore] = useState('');
  const [newStoreItem, setNewStoreItem] = useState({});
  const [loading, setLoading] = useState(true);

  // Listen for real-time updates
  useEffect(() => {
    const q = query(
      collection(db, 'shopping-items'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching items:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addItem = async (e) => {
    e.preventDefault();
    if (newItem.trim() && newStore.trim()) {
      try {
        await addDoc(collection(db, 'shopping-items'), {
          name: newItem.trim(),
          store: newStore.trim(),
          completed: false,
          createdAt: serverTimestamp()
        });
        setNewItem('');
        setNewStore('');
      } catch (error) {
        console.error('Error adding item:', error);
      }
    }
  };

  const addItemToStore = async (e, store, item) => {
    e.preventDefault();
    if (store.trim() && item.trim()) {
      try {
        await addDoc(collection(db, 'shopping-items'), {
          name: item.trim(),
          store: store,
          completed: false,
          createdAt: serverTimestamp()
        });
        setNewStoreItem(prevStoreItemInputs => ({
          ...prevStoreItemInputs,
          [store]: ""
        }));
      } catch (error) {
        console.error('Error adding item:', error);
      }
    }
  }

  const toggleItem = async (id, completed) => {
    try {
      const itemRef = doc(db, 'shopping-items', id);
      await updateDoc(itemRef, { completed: !completed });
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const deleteItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'shopping-items', id));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const clearCompleted = async () => {
    const completedItems = items.filter(item => item.completed);
    try {
      await Promise.all(
        completedItems.map(item => 
          deleteDoc(doc(db, 'shopping-items', item.id))
        )
      );
    } catch (error) {
      console.error('Error clearing completed items:', error);
    }
  };

  // Group items by store
  const itemsByStore = items.reduce((acc, item) => {
    if (!acc[item.store]) {
      acc[item.store] = [];
    }
    acc[item.store].push(item);
    return acc;
  }, {});

  
const handleNewStoreItem = (e, storeName) => { // Renamed 'store' to 'storeName' for clarity
  const itemName = e.target.value;

  setNewStoreItem(prevStoreItemInputs => ({
    ...prevStoreItemInputs, // Copy all existing store inputs
    [storeName]: itemName   // Update/add the specific store's input
  }));
};

  const totalItems = items.length;
  const completedItems = items.filter(item => item.completed).length;

  if (loading) {
    return (
      <>
        <Head>
          <title>Shopping List</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className={styles.container}>
          <div className={styles.loading}>Loading your shopping list...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Shopping List</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="container">
        <header>
          <h1>🛍️ Shopping List</h1>
          {totalItems > 0 && (
            <div className="stats">
              {completedItems} of {totalItems} items completed
            </div>
          )}
        </header>

        <form onSubmit={addItem} className="add-form">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Item name"
            className="item-input"
          />
          <input
            type="text"
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            placeholder="Store name"
            className="store-input"
          />
          <button type="submit" className="add-btn">Add Item</button>
        </form>

        {totalItems > 0 && (
          <div className="actions">
            <button onClick={clearCompleted} className="clear-btn">
              Clear Completed ({completedItems})
            </button>
          </div>
        )}

        <div className="stores">
          {Object.keys(itemsByStore).length === 0 ? (
            <div className="empty-state">
              <p>No items in your shopping list yet.</p>
              <p>Add your first item above!</p>
            </div>
          ) : (
            Object.entries(itemsByStore).map(([store, storeItems]) => (
              <div key={store} className="store-section">
                <h2 className="store-name">{store}</h2>
                <ul className="items-list">
                  {storeItems.map(item => (
                    <li key={item.id} className={`item ${item.completed ? 'completed' : ''}`}>
                      <label className="item-label">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleItem(item.id, item.completed)}
                          className="checkbox"
                        />
                        <span className="item-text">{item.name}</span>
                      </label>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="delete-btn"
                        aria-label="Delete item"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <form onSubmit={(e) => addItemToStore(e, store, newStoreItem[store])} className="add-form">
                  <input
                    type="text"
                    value={newStoreItem[store] || ""}
                    onChange={(e) => handleNewStoreItem(e, store)}
                    placeholder="Item name"
                    className="item-input"
                  />
                  <button type="submit" className="add-btn">Add Item</button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}