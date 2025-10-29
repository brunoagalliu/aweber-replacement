const API_URL = 'http://localhost:3000/api';

// Load lists on page load
document.addEventListener('DOMContentLoaded', () => {
    loadLists();
    loadSubscribers();
});

// Create List
document.getElementById('createListForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('listName').value;
    const description = document.getElementById('listDescription').value;

    try {
        const response = await fetch(`${API_URL}/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        alert(data.message);
        e.target.reset();
        loadLists();
    } catch (error) {
        alert('Error creating list');
    }
});

// Import CSV
document.getElementById('importForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = document.getElementById('csvFile').files[0];
    const listId = document.getElementById('importListId').value;

    formData.append('file', file);
    formData.append('listId', listId);

    try {
        const response = await fetch(`${API_URL}/subscribers/import`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        alert(`Imported: ${data.imported}, Duplicates: ${data.duplicates}`);
        e.target.reset();
        loadSubscribers();
    } catch (error) {
        alert('Error importing CSV');
    }
});

// Add Subscriber
document.getElementById('addSubscriberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const listId = document.getElementById('subscriberListId').value;

    try {
        const response = await fetch(`${API_URL}/subscribers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, firstName, lastName, listId })
        });
        
        const data = await response.json();
        alert(data.message);
        e.target.reset();
        loadSubscribers();
    } catch (error) {
        alert('Error adding subscriber');
    }
});

// Load Lists
async function loadLists() {
    try {
        const response = await fetch(`${API_URL}/lists`);
        const lists = await response.json();
        
        const listsList = document.getElementById('listsList');
        const importSelect = document.getElementById('importListId');
        const subscriberSelect = document.getElementById('subscriberListId');
        
        listsList.innerHTML = '';
        importSelect.innerHTML = '<option value="">Select a list...</option>';
        subscriberSelect.innerHTML = '<option value="">No list (optional)</option>';
        
        lists.forEach(list => {
            listsList.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${list.name}</strong>
                        <p>${list.description || ''}</p>
                    </div>
                    <button class="delete-btn" onclick="deleteList(${list.id})">Delete</button>
                </div>
            `;
            
            importSelect.innerHTML += `<option value="${list.id}">${list.name}</option>`;
            subscriberSelect.innerHTML += `<option value="${list.id}">${list.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading lists:', error);
    }
}

// Load Subscribers
async function loadSubscribers() {
    try {
        const response = await fetch(`${API_URL}/subscribers`);
        const subscribers = await response.json();
        
        const subscribersList = document.getElementById('subscribersList');
        subscribersList.innerHTML = '';
        
        subscribers.forEach(sub => {
            subscribersList.innerHTML += `
                <div class="subscriber-item">
                    <div>
                        <strong>${sub.email}</strong>
                        <p>${sub.first_name || ''} ${sub.last_name || ''}</p>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading subscribers:', error);
    }
}

// Delete List
async function deleteList(id) {
    if (!confirm('Are you sure you want to delete this list?')) return;
    
    try {
        await fetch(`${API_URL}/lists/${id}`, { method: 'DELETE' });
        loadLists();
    } catch (error) {
        alert('Error deleting list');
    }
}