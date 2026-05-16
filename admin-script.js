import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// คีย์โครงการ Firebase หลักของระบบข้อมูลยืมคืนพละ
const firebaseConfig = {
  apiKey: "AIzaSyDy5woHXjPdH7816Im7MloAlbLJIi4Bdk",
  authDomain: "bu-sports-lending.firebaseapp.com",
  databaseURL: "https://bu-sports-lending-default-rtdb.firebaseio.com",
  projectId: "bu-sports-lending",
  storageBucket: "bu-sports-lending.firebasestorage.app",
  messagingSenderId: "490655574322",
  appId: "1:490655574322:web:79e62b6b6d7c6d8368f2b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// โครงสร้างเมทาดาต้าสำหรับผูกคำนวณหน้าเว็บแอดมิน
let EQUIP_META = {
  football: { name: "ลูกฟุตบอล", emoji: "⚽", total: 5 },
  volleyball: { name: "วอลเลย์บอล", emoji: "🏐", total: 5 },
  basketball: { name: "บาสเกตบอล", emoji: "🏀", total: 5 },
  pingpong: { name: "ปิงปอง (แพ็ค)", emoji: "🏓", total: 5 },
  badminton: { name: "แบดมินตัน (ไม้)", emoji: "🏸", total: 5 },
  tennis: { name: "เทนนิส", emoji: "🎾", total: 5 },
};

let currentOnlineOut = {};

// ตัวตัดฟอร์แมตเวลา
function fmtTime(dateString) {
  if (!dateString) return "-";
  return (
    new Date(dateString).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " น."
  );
}

// 1. ตรวจจับและดึงสถิติจำนวนอุปกรณ์ที่มีการอัปเดตบนเบส
function listenToEquipments() {
  onValue(ref(db, "equipmentOut"), (snapshot) => {
    const data = snapshot.val() || {};
    currentOnlineOut = data;
    renderEquipTable();
    calculateGlobalStats();
  });
}

// 2. ดักดึงรายชื่อเด็กทุกคนที่ยังไม่ยอมคืนของส่งโรงพละ
function listenToActiveUsers() {
  onValue(ref(db, "users"), (snapshot) => {
    const usersData = snapshot.val();
    const container = document.getElementById("admin-user-list");
    if (!container) return;

    if (!usersData) {
      container.innerHTML = `<div class="empty-state">ไม่มีผู้ใช้งานที่ค้างยืมอุปกรณ์</div>`;
      return;
    }

    let htmlContent = "";
    const now = new Date();

    Object.keys(usersData).forEach((userId) => {
      const user = usersData[userId];
      if (!user.borrows) return;

      const activeBorrows = user.borrows.filter((b) => b.active === true);
      if (activeBorrows.length === 0) return;

      const profile = user.profile || { name: "ไม่ทราบชื่อ", faculty: "-" };

      htmlContent += `
        <div class="user-card">
          <div class="user-card-header">
            <div>
              <b>${profile.name}</b>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${profile.faculty}</div>
            </div>
            <span class="uid-tag">${userId}</span>
          </div>
          <div class="item-badge-row">
            ${activeBorrows
              .map((b) => {
                const isOverdue = new Date(b.returnBy) < now;
                return `
                <div class="item-sub-badge ${isOverdue ? "overdue" : ""}">
                  ${isOverdue ? "⚠️ " : ""}${b.emoji} ${b.name} (ส่งคืนก่อน: ${fmtTime(b.returnBy)})
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `;
    });

    container.innerHTML =
      htmlContent ||
      `<div class="empty-state">ไม่มีผู้ใช้งานที่ค้างยืมอุปกรณ์</div>`;
  });
}

// วาด UI ตารางอุปกรณ์
function renderEquipTable() {
  const tbody = document.getElementById("admin-equip-table");
  if (!tbody) return;

  tbody.innerHTML = Object.keys(EQUIP_META)
    .map((key) => {
      const meta = EQUIP_META[key];
      const out = currentOnlineOut[key] || 0;
      const avail = Math.max(0, meta.total - out);

      return `
      <tr>
        <td><span style="font-size:1.2rem; margin-right:0.4rem;">${meta.emoji}</span> <b>${meta.name}</b></td>
        <td><strong>${meta.total}</strong> ชิ้น</td>
        <td style="color:var(--warning); font-weight:600;">${out}</td>
        <td style="color:var(--success); font-weight:600;">${avail}</td>
        <td>
          <div class="stock-ctrl">
            <button class="btn-stock" onclick="window.changeStockTotal('${key}', -1)">-</button>
            <button class="btn-stock" onclick="window.changeStockTotal('${key}', 1)">+</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

// ยัดสถิติคำนวณลงการ์ดด้านบน
function calculateGlobalStats() {
  let totalStock = 0;
  let totalOut = 0;

  Object.keys(EQUIP_META).forEach((key) => {
    totalStock += EQUIP_META[key].total;
    totalOut += currentOnlineOut[key] || 0;
  });

  const totalAvail = Math.max(0, totalStock - totalOut);

  if (document.getElementById("adm-total"))
    document.getElementById("adm-total").textContent = totalStock;
  if (document.getElementById("adm-out"))
    document.getElementById("adm-out").textContent = totalOut;
  if (document.getElementById("adm-avail"))
    document.getElementById("adm-avail").textContent = totalAvail;
}

// สั่งปรับแต่งจำนวนไอเทมทั้งหมดในสต็อกส่วนกลาง
window.changeStockTotal = function (key, val) {
  const target = EQUIP_META[key];
  if (!target) return;

  const currentOut = currentOnlineOut[key] || 0;
  if (target.total + val < currentOut) {
    alert(
      `ไม่สามารถลดสต็อกลงได้ เนื่องจากนักศึกษายืมค้างอยู่จำนวน ${currentOut} ชิ้น`,
    );
    return;
  }

  if (target.total + val < 0) return;

  target.total += val;
  renderEquipTable();
  calculateGlobalStats();
};

window.addEventListener("DOMContentLoaded", () => {
  listenToEquipments();
  listenToActiveUsers();
});
