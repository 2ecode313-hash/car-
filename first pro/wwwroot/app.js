const formatEGP = value => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value) + ' ج.م';
const invoiceModal = document.getElementById('invoiceModal');
const simpleModal = document.getElementById('simpleModal');
let invoices = [];

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  const data = await response.json();
  invoices = data.invoices;
  document.getElementById('invoiceCount').textContent = data.invoiceCount;
  document.getElementById('paidAmount').textContent = formatEGP(data.paid);
  document.getElementById('pendingAmount').textContent = formatEGP(data.pending);
  document.getElementById('customerCount').textContent = data.customers;
  renderInvoices();
  await loadDirectoryData();
}

async function loadDirectoryData() {
  const [customers, cars, services] = await Promise.all([
    fetch('/api/customers').then(r => r.json()),
    fetch('/api/cars').then(r => r.json()),
    fetch('/api/services').then(r => r.json())
  ]);
  document.getElementById('customerRows').innerHTML = customers.map(item => `<tr><td><strong>${item.name}</strong></td><td>${item.phone}</td><td>${item.area}</td><td><button class="row-action" onclick="showToast('بيانات العميل جاهزة')">⋮</button></td></tr>`).join('');
  document.getElementById('carRows').innerHTML = cars.map(item => `<tr><td>${item.owner}</td><td><strong>${item.model}</strong></td><td>${item.plate}</td><td><button class="row-action" onclick="showToast('بيانات السيارة جاهزة')">⋮</button></td></tr>`).join('');
  document.getElementById('serviceRows').innerHTML = services.map(item => `<article><span>${item.name}</span><strong>${formatEGP(item.price)}</strong></article>`).join('');
}

function renderInvoices() {
  const recent = document.getElementById('recentInvoices');
  const all = document.getElementById('allInvoices');
  if (recent) recent.innerHTML = invoices.slice(0, 4).map(rowTemplate(false)).join('');
  if (all) all.innerHTML = invoices.map(rowTemplate(true)).join('');
}

function rowTemplate(full) {
  return invoice => `<tr><td><strong>#INV-${invoice.id}</strong></td><td>${invoice.customer}</td><td>${invoice.car}</td><td>${invoice.service}</td><td><strong>${formatEGP(invoice.total)}</strong></td><td><span class="status ${invoice.status}">${invoice.status}</span></td>${full ? `<td>${invoice.date}</td>` : ''}<td><button class="row-action" title="تعديل" onclick="editInvoice(${invoice.id})">✎</button> <button class="row-action" title="طباعة" onclick="printInvoice(${invoice.id})">▣</button> <button class="row-action" title="حذف" onclick="deleteInvoice(${invoice.id})">×</button></td></tr>`;
}

const pageTitles = { dashboard:'لوحة التحكم', invoices:'الفواتير', customers:'العملاء', cars:'السيارات', services:'خدمات الورشة' };
function showPage(name) {
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === name));
  document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === name));
  document.getElementById('pageTitle').textContent = pageTitles[name] || name;
}

function openNewInvoice() {
  document.getElementById('invoiceForm').reset();
  document.querySelector('[name="id"]').value = '0';
  document.getElementById('invoiceModalTitle').textContent = 'إصدار فاتورة جديدة';
  invoiceModal.showModal();
}

function editInvoice(id) {
  const invoice = invoices.find(item => item.id === id);
  if (!invoice) return;
  const form = document.getElementById('invoiceForm');
  form.elements.id.value = invoice.id;
  form.elements.customer.value = invoice.customer;
  form.elements.car.value = invoice.car;
  form.elements.service.value = invoice.service;
  form.elements.total.value = invoice.total;
  form.elements.status.value = invoice.status;
  document.getElementById('invoiceModalTitle').textContent = `تعديل فاتورة #INV-${invoice.id}`;
  invoiceModal.showModal();
}

async function deleteInvoice(id) {
  if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
  const response = await fetch(`/api/invoices/${id}`, { method:'DELETE' });
  if (response.ok) { await loadDashboard(); showToast('تم حذف الفاتورة'); }
}

function printInvoice(id) {
  const invoice = invoices.find(item => item.id === id);
  if (!invoice) return;
  const printWindow = window.open('', '_blank', 'width=760,height=700');
  printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة #INV-${invoice.id}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#20304a}.head{display:flex;justify-contentspace-between;border-bottom:2px solid #315bdb;padding-bottom:20px}.head h1{margin:0}.box{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:24px}.total{font-size:24px;color:#315bdb;margin-top:20px}@media print{button{display:none}}</style></head><body><div class="head"><div><h1>مركز DRIVE للصيانة</h1><p>فاتورة صيانة سيارات</p></div><div><strong>#INV-${invoice.id}</strong><br>${invoice.date}</div></div><div class="box"><p><strong>العميل:</strong> ${invoice.customer}</p><p><strong>السيارة:</strong> ${invoice.car}</p><p><strong>العمل المطلوب:</strong> ${invoice.service}</p><p><strong>حالة الدفع:</strong> ${invoice.status}</p><p class="total">الإجمالي: ${formatEGP(invoice.total)}</p></div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach(item => item.addEventListener('click', () => showPage(item.dataset.pageLink)));
['openInvoice','openInvoice2'].forEach(id => document.getElementById(id)?.addEventListener('click', openNewInvoice));
document.querySelectorAll('.close-modal').forEach(button => button.addEventListener('click', () => invoiceModal.close()));
window.addEventListener('click', event => { if (event.target === invoiceModal) invoiceModal.close(); });

document.getElementById('invoiceForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const id = Number(form.get('id'));
  const invoice = {
    id,
    customer: form.get('customer'),
    car: form.get('car'),
    service: form.get('service'),
    total: Number(form.get('total')),
    status: form.get('status'),
    date: new Date().toISOString().slice(0, 10)
  };
  const response = await fetch(id ? `/api/invoices/${id}` : '/api/invoices', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoice)
  });
  if (response.ok) {
    invoiceModal.close();
    await loadDashboard();
    showPage('invoices');
    showToast(id ? 'تم تعديل الفاتورة بنجاح' : 'تم حفظ الفاتورة بنجاح');
  }
});

let activeSimpleType = '';
function openSimple(type) {
  activeSimpleType = type;
  const fields = document.getElementById('simpleFields');
  const config = {
    customer: ['عميل جديد', 'بيانات العميل', '<label class="full">اسم العميل<input name="name" required></label><label>رقم الهاتف<input name="phone" required></label><label>المنطقة<input name="area" required></label>'],
    car: ['سيارة جديدة', 'بيانات السيارة', '<label>اسم المالك<input name="owner" required></label><label>الموديل<input name="model" required></label><label class="full">لوحة الترخيص<input name="plate" required></label>'],
    service: ['خدمة جديدة', 'بيانات الخدمة', '<label class="full">اسم الخدمة<input name="name" required></label><label class="full">السعر (ج.م)<input name="price" type="number" min="1" required></label>']
  };
  const [title, eyebrow, markup] = config[type];
  document.getElementById('simpleTitle').textContent = title;
  document.getElementById('simpleEyebrow').textContent = eyebrow;
  fields.innerHTML = markup;
  document.getElementById('simpleForm').reset();
  fields.innerHTML = markup;
  simpleModal.showModal();
}

document.getElementById('openCustomer')?.addEventListener('click', () => openSimple('customer'));
document.getElementById('openCar')?.addEventListener('click', () => openSimple('car'));
document.getElementById('openService')?.addEventListener('click', () => openSimple('service'));
document.querySelectorAll('.close-simple').forEach(button => button.addEventListener('click', () => simpleModal.close()));

document.getElementById('simpleForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  let endpoint = '';
  let body = {};
  if (activeSimpleType === 'customer') {
    endpoint = '/api/customers';
    body = { id: 0, name: form.get('name'), phone: form.get('phone'), area: form.get('area') };
  } else if (activeSimpleType === 'car') {
    endpoint = '/api/cars';
    body = { id: 0, owner: form.get('owner'), model: form.get('model'), plate: form.get('plate') };
  } else {
    endpoint = '/api/services';
    body = { id: 0, name: form.get('name'), price: Number(form.get('price')) };
  }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (response.ok) {
    simpleModal.close();
    await loadDashboard();
    showToast('تم حفظ البيانات بنجاح');
  }
});

document.getElementById('globalSearch').addEventListener('input', event => {
  const term = event.target.value.trim().toLowerCase();
  if (!term) { renderInvoices(); return; }
  const filtered = invoices.filter(invoice => Object.values(invoice).some(value => String(value).toLowerCase().includes(term)));
  document.getElementById('allInvoices').innerHTML = filtered.map(rowTemplate(true)).join('');
  showPage('invoices');
});

const months = ['يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر'];
const values = [58, 72, 64, 88, 78, 96];
document.querySelector('.bars').innerHTML = months.map((month, index) => `<div class="bar-wrap"><i style="height:${values[index]}%"></i><span>${month}</span></div>`).join('');

loadDashboard();
