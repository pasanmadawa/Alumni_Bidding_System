(function () {
  const state = {
    accessToken: localStorage.getItem('accessToken') || ''
  };

  const sectionConfigs = {
    degrees: [
      { name: 'title', label: 'Degree Title', type: 'text', placeholder: 'BEng Software Engineering' },
      { name: 'institutionUrl', label: 'Official Degree URL', type: 'url', placeholder: 'https://www.westminster.ac.uk' },
      { name: 'completionDate', label: 'Completion Date', type: 'date' }
    ],
    certifications: [
      { name: 'name', label: 'Certification Name', type: 'text', placeholder: 'AWS Cloud Practitioner' },
      { name: 'issuerUrl', label: 'Certification URL', type: 'url', placeholder: 'https://example.com/certification' },
      { name: 'completionDate', label: 'Completion Date', type: 'date' }
    ],
    licences: [
      { name: 'name', label: 'Licence Name', type: 'text', placeholder: 'Professional Licence' },
      { name: 'issuerUrl', label: 'Awarding Body URL', type: 'url', placeholder: 'https://example.com/licence' },
      { name: 'completionDate', label: 'Completion Date', type: 'date' }
    ],
    courses: [
      { name: 'name', label: 'Course Name', type: 'text', placeholder: 'Advanced Node.js' },
      { name: 'courseUrl', label: 'Course URL', type: 'url', placeholder: 'https://example.com/course' },
      { name: 'completionDate', label: 'Completion Date', type: 'date' }
    ],
    employment: [
      { name: 'company', label: 'Company', type: 'text', placeholder: 'Tech Company' },
      { name: 'role', label: 'Role', type: 'text', placeholder: 'Software Engineer' },
      { name: 'startDate', label: 'Start Date', type: 'date' },
      { name: 'endDate', label: 'End Date', type: 'date' }
    ]
  };

  function setStatus(message, type) {
    const el = document.getElementById('profile-status');
    el.textContent = message;
    el.className = 'status ' + (type || 'info');
  }

  function showResponse(data, type) {
    const el = document.getElementById('profile-response');
    el.textContent = JSON.stringify(data, null, 2);
    el.className = 'status ' + (type || 'info');
  }

  function syncSessionDisplay() {
    document.getElementById('profile-access-token').textContent = state.accessToken || 'Not set';
  }

  async function api(path, options) {
    const headers = Object.assign({}, options && options.headers ? options.headers : {});

    if (state.accessToken) {
      headers.Authorization = 'Bearer ' + state.accessToken;
    }

    if (!(options && options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, {
      method: options && options.method ? options.method : 'GET',
      headers: headers,
      body: options && options.body !== undefined
        ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
        : undefined,
      credentials: 'include'
    });

    const data = await response.json().catch(function () {
      return { message: 'Non-JSON response' };
    });

    if (!response.ok) {
      throw data;
    }

    return data;
  }

  function createCollectionItem(section, data) {
    const container = document.createElement('div');
    container.className = 'item-card stack';

    const row = document.createElement('div');
    row.className = 'row';

    sectionConfigs[section].forEach(function (field) {
      const label = document.createElement('label');
      label.textContent = field.label;
      const input = document.createElement('input');
      input.type = field.type;
      input.placeholder = field.placeholder || '';
      input.dataset.field = field.name;
      input.value = data && data[field.name]
        ? (field.type === 'date' ? String(data[field.name]).slice(0, 10) : data[field.name])
        : '';
      label.appendChild(input);
      row.appendChild(label);
    });

    const actions = document.createElement('div');
    actions.className = 'actions';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'danger';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', function () {
      container.remove();
    });
    actions.appendChild(removeButton);

    container.appendChild(row);
    container.appendChild(actions);

    return container;
  }

  function addItem(section, data) {
    document.getElementById(section).appendChild(createCollectionItem(section, data || {}));
  }

  function clearSection(section) {
    document.getElementById(section).innerHTML = '';
  }

  function collectSection(section) {
    return Array.from(document.querySelectorAll('#' + section + ' .item-card')).map(function (card) {
      const item = {};
      card.querySelectorAll('[data-field]').forEach(function (input) {
        item[input.dataset.field] = input.value || null;
      });
      return item;
    }).filter(function (item) {
      return Object.keys(item).some(function (key) {
        return item[key];
      });
    });
  }

  function populateProfile(profile) {
    document.getElementById('firstName').value = profile && profile.firstName || '';
    document.getElementById('lastName').value = profile && profile.lastName || '';
    document.getElementById('contactNumber').value = profile && profile.contactNumber || '';
    document.getElementById('linkedinUrl').value = profile && profile.linkedinUrl || '';
    document.getElementById('bio').value = profile && profile.bio || '';

    const image = document.getElementById('profile-image-preview');
    image.src = profile && profile.profileImage ? profile.profileImage : '';
    image.style.display = profile && profile.profileImage ? 'block' : 'none';

    ['degrees', 'certifications', 'licences', 'courses', 'employment'].forEach(function (section) {
      clearSection(section);
      const items = profile && profile[section] ? profile[section] : [];
      if (items.length) {
        items.forEach(function (item) {
          addItem(section, item);
        });
      } else {
        addItem(section, {});
      }
    });
  }

  document.getElementById('load-profile-button').addEventListener('click', async function () {
    try {
      setStatus('Loading profile...', 'info');
      state.accessToken = localStorage.getItem('accessToken') || '';
      syncSessionDisplay();
      const data = await api('/api/profile/me');
      populateProfile(data.profile);
      setStatus('Profile loaded successfully', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Failed to load profile. Login first in the auth portal.', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('save-profile-button').addEventListener('click', async function () {
    try {
      setStatus('Saving profile...', 'info');
      state.accessToken = localStorage.getItem('accessToken') || '';
      syncSessionDisplay();
      const payload = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        contactNumber: document.getElementById('contactNumber').value,
        linkedinUrl: document.getElementById('linkedinUrl').value,
        bio: document.getElementById('bio').value,
        degrees: collectSection('degrees'),
        certifications: collectSection('certifications'),
        licences: collectSection('licences'),
        courses: collectSection('courses'),
        employment: collectSection('employment')
      };
      const data = await api('/api/profile/me', {
        method: 'PUT',
        body: payload
      });
      populateProfile(data.profile);
      setStatus('Profile saved successfully', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Failed to save profile', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('upload-image-button').addEventListener('click', async function () {
    try {
      const fileInput = document.getElementById('profile-image-input');
      if (!fileInput.files.length) {
        throw { message: 'Choose an image first' };
      }
      setStatus('Uploading profile image...', 'info');
      state.accessToken = localStorage.getItem('accessToken') || '';
      syncSessionDisplay();
      const formData = new FormData();
      formData.append('profileImage', fileInput.files[0]);
      const data = await api('/api/profile/me/image', {
        method: 'POST',
        body: formData,
        headers: {}
      });
      document.getElementById('profile-image-preview').src = data.profileImage;
      document.getElementById('profile-image-preview').style.display = 'block';
      setStatus('Profile image uploaded successfully', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Image upload failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('add-degree').addEventListener('click', function () { addItem('degrees', {}); });
  document.getElementById('add-certification').addEventListener('click', function () { addItem('certifications', {}); });
  document.getElementById('add-licence').addEventListener('click', function () { addItem('licences', {}); });
  document.getElementById('add-course').addEventListener('click', function () { addItem('courses', {}); });
  document.getElementById('add-employment').addEventListener('click', function () { addItem('employment', {}); });

  syncSessionDisplay();
  populateProfile(null);
})();
