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
// NEW IMPORTS FOR AUTHENTICATION
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'; //
import styles from '../styles/Loading.module.css'; // Assuming this is for your loading spinner
// You might also have a main CSS module like styles/ShoppingList.module.css
// I'll add inline styles for auth elements for simplicity, or you can integrate them.

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [newStore, setNewStore] = useState('');
  const [newStoreItem, setNewStoreItem] = useState({});
  const [loading, setLoading] = useState(true);

  // NEW STATE: To store the authenticated user
  const [user, setUser] = useState(null); //

  // Initialize Firebase Auth
  const auth = getAuth(); //

  // Effect to listen for authentication state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => { //
      setUser(currentUser); //
      // If there's no user, and items haven't been loaded yet,
      // we can stop loading immediately as we won't fetch data without a user.
      if (!currentUser && items.length === 0) {
        setLoading(false);
      }
    });
    return () => unsubscribeAuth(); // Clean up auth listener on component unmount
  }, [auth, items.length]); // Dependencies: auth instance and items.length to prevent unnecessary re-renders of the effect

  useEffect(() => {
    if (!user) { // Only fetch data if a user is logged in
      setItems([]); // Clear items if user logs out
      setLoading(false); //
      return; // Exit if no user
    }

    const q = query(
      collection(db, 'shopping-items'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => { //
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsData); //
      setLoading(false); //
    }, (error) => {
      console.error('Error fetching items:', error);
      setLoading(false);
    });

    return () => unsubscribe(); // Clean up Firestore listener
  }, [user]); // Now depends on 'user' state

  // Function to add a new item from the main form
  const addItem = async (e) => {
    e.preventDefault();
    if (newItem.trim() && newStore.trim()) {
      if (!user) { // Check if user is logged in
        alert('Please sign in to add items!');
        return;
      }
      try {
        await addDoc(collection(db, 'shopping-items'), { //
          name: newItem.trim(), //
          store: newStore.trim(), //
          completed: false, //
          ownerId: user.uid, // <--- ADD THIS: Store the user's UID with the item
          createdAt: serverTimestamp() //
        });
        setNewItem(''); //
        setNewStore(''); //
      } catch (error) {
        console.error('Error adding item:', error); //
      }
    }
  };

  // Function to add an item to an already displayed store card
  const addItemToStore = async (e, store, item) => {
    e.preventDefault();
    if (store.trim() && item.trim()) {
      if (!user) { // Check if user is logged in
        alert('Please sign in to add items!');
        return;
      }
      try {
        await addDoc(collection(db, 'shopping-items'), { //
          name: item.trim(), //
          store: store, //
          completed: false, //
          ownerId: user.uid, // <--- ADD THIS: Store the user's UID with the item
          createdAt: serverTimestamp() //
        });
        setNewStoreItem(prevStoreItemInputs => ({
          ...prevStoreItemInputs,
          [store]: ""
        }));
      } catch (error) {
        console.error('Error adding item:', error); //
      }
    }
  }

  const toggleItem = async (id, completed) => {
    if (!user) return; // Prevent action if not logged in
    try {
      const itemRef = doc(db, 'shopping-items', id); //
      await updateDoc(itemRef, { completed: !completed }); //
    } catch (error) {
      console.error('Error updating item:', error); //
    }
  };

  const deleteItem = async (id) => {
    if (!user) return; // Prevent action if not logged in
    try {
      await deleteDoc(doc(db, 'shopping-items', id)); //
    } catch (error) {
      console.error('Error deleting item:', error); //
    }
  };

  const clearCompleted = async () => {
    if (!user) return; // Prevent action if not logged in
    const completedItems = items.filter(item => item.completed); //
    try {
      await Promise.all( //
        completedItems.map(item =>
          deleteDoc(doc(db, 'shopping-items', item.id)) //
        )
      );
    } catch (error) {
      console.error('Error clearing completed items:', error); //
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

  const handleNewStoreItem = (e, storeName) => {
    const itemName = e.target.value;
    setNewStoreItem(prevStoreItemInputs => ({
      ...prevStoreItemInputs,
      [storeName]: itemName
    }));
  };

  const totalItems = items.length;
  const completedItemsCount = items.filter(item => item.completed).length; // Renamed to avoid conflict

  // NEW: Google Sign-in function
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider(); //
    try {
      await signInWithPopup(auth, provider); //
    } catch (error) {
      console.error('Error signing in with Google:', error); //
      alert('Error signing in: ' + error.message); //
    }
  };

  // NEW: Sign-out function
  const handleSignOut = async () => {
    try {
      await signOut(auth); //
      setItems([]); // Clear items on sign out
      setNewStoreItem({}); // Clear inputs on sign out
    } catch (error) {
      console.error('Error signing out:', error); //
      alert('Error signing out: ' + error.message); //
    }
  };

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
          {/* Authentication Status and Buttons */}
          <div className="auth-status">
            {user ? (
              <>
                <span>Logged in as: {user.displayName || user.email}</span>
                <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
              </>
            ) : (
              <>
                <p>Please sign in to manage your shopping list.</p>
                <button onClick={handleGoogleSignIn} className="sign-in-btn">Sign In with Google</button>
              </>
            )}
          </div>

          {totalItems > 0 && user && ( // Only show stats if logged in and items exist
            <div className="stats">
              {completedItemsCount} of {totalItems} items completed
            </div>
          )}
        </header>

        {/* Conditionally render content only if user is logged in */}
        {user ? (
          <>
            <form onSubmit={addItem} className="add-form">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Enter item name..."
                className="item-input"
              />
              <input
                type="text"
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
                placeholder="Store name..."
                className="store-input"
              />
              <button type="submit" className="add-btn">Add Item</button>
            </form>

            {totalItems > 0 && (
              <div className="actions">
                <button onClick={clearCompleted} className="clear-btn">
                  Clear Completed ({completedItemsCount})
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
          </>
        ) : (
          // Message displayed when not logged in
          <div className="not-logged-in-message">
            Sign in with your Google account to manage your shopping list.
          </div>
        )}
      </div>

      <style jsx>{`
        /* Add these styles to your existing <style jsx> block or your CSS Module */
        .auth-status {
          margin-top: 15px;
          padding: 10px;
          background-color: #ecf0f1;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .auth-status span {
          font-size: 15px;
          color: #34495e;
          font-weight: 500;
        }

        .sign-in-btn, .sign-out-btn {
          background-color: #3498db; /* Blue for sign in */
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s ease;
          white-space: nowrap; /* Prevent button text from wrapping */
        }

        .sign-in-btn:hover {
          background-color: #2980b9;
          transform: translateY(-1px);
        }

        .sign-out-btn {
          background-color: #e74c3c; /* Red for sign out */
        }

        .sign-out-btn:hover {
          background-color: #c0392b;
          transform: translateY(-1px);
        }

        .not-logged-in-message {
          text-align: center;
          margin-top: 50px;
          font-size: 18px;
          color: #7f8c8d;
        }

        /* Your existing styles below this */
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          min-height: 100vh;
        }

        header {
          text-align: center;
          margin-bottom: 30px;
        }

        h1 {
          color: #2c3e50;
          margin-bottom: 10px;
          font-size: 2.5em;
          font-weight: 600;
        }

        .list-info {
          margin-bottom: 10px;
        }

        .current-list {
          color: #3498db;
          font-size: 14px;
          margin-bottom: 5px;
        }

        .stats {
          color: #7f8c8d;
          font-size: 0.9em;
        }

        .add-form {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .item-input, .store-input {
          flex: 1;
          min-width: 200px;
          padding: 12px;
          border: 1px solid #e0e6ed;
          border-radius: 8px;
          font-size: 16px;
          transition: all 0.3s ease;
          background-color: #ffffff;
          color: #2c3e50;
        }

        .item-input:focus, .store-input:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .add-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .add-btn:hover {
          background: #2980b9;
          transform: translateY(-1px);
        }

        .actions {
          margin-bottom: 20px;
          text-align: center;
        }

        .clear-btn {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .clear-btn:hover {
          background: #c0392b;
          transform: translateY(-1px);
        }

        .empty-state {
          text-align: center;
          color: #95a5a6;
          margin: 40px 0;
        }

        .empty-state p {
          margin: 10px 0;
          font-size: 16px;
        }

        .store-section {
          margin-bottom: 30px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .store-name {
          color: #2c3e50;
          margin: 0 0 15px 0;
          font-size: 1.3em;
          font-weight: 600;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 8px;
        }

        .items-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f1f3f4;
        }

        .item:last-child {
          border-bottom: none;
        }

        .item.completed {
          opacity: 0.7;
        }

        .item-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          flex: 1;
        }

        .checkbox {
          margin-right: 12px;
          transform: scale(1.2);
          accent-color: #3498db;
        }

        .item-text {
          font-size: 16px;
          color: #2c3e50;
          transition: all 0.3s ease;
        }

        .item.completed .item-text {
          text-decoration: line-through;
          color: #95a5a6;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #e74c3c;
          font-size: 20px;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: 4px;
          transition: all 0.3s ease;
        }

        .delete-btn:hover {
          background: #ffeaea;
          transform: scale(1.1);
        }

        @media (max-width: 600px) {
          .add-form {
            flex-direction: column;
          }

          .item-input, .store-input {
            min-width: auto;
          }

          h1 {
            font-size: 2em;
          }
        }

        :global(body) {
          margin: 0;
          background-color: #f8f9fa;
        }

        :global(input::placeholder) {
          color: #95a5a6;
        }
      `}</style>
    </>
  );
}