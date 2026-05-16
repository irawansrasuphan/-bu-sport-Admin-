/* =========================================================
   Sports Lending System - admin-script.js (Fixed ID Mismatch)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// คีย์โครงการ Firebase (สตรีมมิ่งเซ็ตอัพเรียบร้อย)
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

/* โครงสร้างข้อมูลอุปกรณ์หลักภายในระบบ */
let EQUIP = [
  { id: "football", name: "ลูกฟุตบอล", emoji: "⚽", total: 5, out: 0 },
  { id: "volleyball", name: "วอลเลย์บอล", emoji: "🏐", total: 5, out: 0 },
  { id: "basketball", name: "บาสเกตบอล", emoji: "🏀", total: 5, out: 0 },
  { id: "pingpong", name: "ปิงปอง (แพ็ค)", emoji: "🏓", total: 5, out: 0 },
  { id: "badminton", name: "แบดมินตัน (ไม้)", emoji: "🏸", total: 5, out: 0 },
  { id: "tennis", name: "เทนนิส", emoji: "🎾", total: 5, out: 0 },
];

// ฟังก์ชันสำหรับแปลงรูปแบบเวลา
function fmt(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return (
    date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) +
    " น."
  );
}

/* =========================================================
   FIREBASE REALTIME SYNC (READ & AUTO PROGRESS)
========================================================= */
function listenToFirebaseData() {
  let currentTotals = {};

  // 1. ดักฟังข้อมูลการตั้งค่าสต็อกคลังอุปกรณ์จากแอดมิน
  onValue(ref(db, "equipment"), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      EQUIP.forEach((item) => {
        if (data[item.id]) {
          currentTotals[item.id] =
            data[item.id].total !== undefined
              ? parseInt(data[item.id].total)
              : item.total;
        }
      });
    } else {
      initDefaultEquipment();
    }
    // ส่งยอดไปคำนวณซ้อนร่วมกับรายการค้างยืมของนักศึกษา
    fetchAndSyncUsersData(currentTotals);
  });
}

// 2. ดักฟังรายการของผู้ใช้งานทุกคนและบวกยอดคำนวณผู้ค้างยืมแบบเรียลไทม์
function fetchAndSyncUsersData(currentTotals) {
  onValue(ref(db, "users"), (snapshot) => {
    const usersData = snapshot.val();

    // ชี้เป้าไปที่คอนเทนเนอร์แสดงรายชื่อนักศึกษาขวามือใน HTML
    const pendingContainer = document.getElementById("admin-user-list");

    // เคลียร์ยอดการยืมเก่าออกให้พร้อมก่อนประมวลผลลัพธ์รอบใหม่
    EQUIP.forEach((item) => {
      item.total =
        currentTotals[item.id] !== undefined
          ? currentTotals[item.id]
          : item.total;
      item.out = 0;
    });

    let html = "";
    const now = new Date();

    if (usersData) {
      Object.keys(usersData).forEach((userId) => {
        const user = usersData[userId];
        if (user.borrows && user.borrows.length > 0) {
          // คัดเฉพาะรายการที่นักเรียนกดยืมและยังค้างส่งคืน (active === true)
          const activeBorrows = user.borrows.filter((b) => b.active);

          activeBorrows.forEach((borrow) => {
            // บวกยอดสะสมสถานะกำลังยืมเข้าสู่โหนดของอุปกรณ์ชิ้นนั้นๆ
            const targetEquip = EQUIP.find((e) => e.id === borrow.id);
            if (targetEquip) {
              targetEquip.out++;
            }

            // ตรวจสอบสถานะว่าคืนอุปกรณ์เกินกำหนดเวลาหรือไม่
            const isOverdue = new Date(borrow.returnBy) < now;

            // รวบรวมการ์ดผู้ยืมเข้าสู่โครงสร้างที่สัมพันธ์กับดีไซน์ CSS ใหม่
            html += `
              <div class="user-card">
                <div class="user-card-header">
                  <b>${user.profile?.name || "ไม่ระบุชื่อ"}</b>
                  <span class="uid-tag">${userId}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                  คณะ: ${user.profile?.faculty || "-"}
                </div>
                <div class="item-badge-row">
                  <span class="item-sub-badge ${isOverdue ? "overdue" : ""}">
                    ${borrow.emoji || "📦"} ${borrow.name} (คืนก่อน: ${fmt(borrow.returnBy)})
                  </span>
                </div>
              </div>
            `;
          });
        }
      });
    }

    if (pendingContainer) {
      pendingContainer.innerHTML =
        html ||
        `
        <div class="empty-state">ไม่มีผู้ใช้งานที่ค้างยืมอุปกรณ์</div>
      `;
    }

    // อัปเดตสถิติตัวเลขสรุปด้านบนและอัปเดตข้อมูลตารางจัดการสินค้า
    updateStats();
    renderEquipTable();
  });
}

function initDefaultEquipment() {
  const initData = {};
  EQUIP.forEach((item) => {
    initData[item.id] = { total: item.total, out: 0 };
  });
  set(ref(db, "equipment"), initData);
}

/* =========================================================
   UI RENDER CONTROL (เชื่อมต่อไอดีเข้าหา HTML ล่าสุด)
========================================================= */
function updateStats() {
  let sumTotal = 0;
  let sumOut = 0;

  EQUIP.forEach((e) => {
    sumTotal += e.total;
    sumOut += e.out;
  });

  const sumAvail = Math.max(0, sumTotal - sumOut);

  // แมตช์กับไอดีของกล่องสี่เหลี่ยมด้านบนในไฟล์ HTML เรียบร้อยแล้ว (adm-total, adm-out, adm-avail)
  if (document.getElementById("adm-total"))
    document.getElementById("adm-total").textContent = sumTotal;
  if (document.getElementById("adm-out"))
    document.getElementById("adm-out").textContent = sumOut;
  if (document.getElementById("adm-avail"))
    document.getElementById("adm-avail").textContent = sumAvail;
}

function renderEquipTable() {
  // แมตช์แท็ก tbody ประจำตารางของแอดมิน (admin-equip-table)
  const tableBody = document.getElementById("admin-equip-table");
  if (!tableBody) return;

  tableBody.innerHTML = EQUIP.map((e) => {
    const avail = Math.max(0, e.total - e.out);
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem; font-weight: 500;">
            <span style="font-size: 1.2rem;">${e.emoji}</span> ${e.name}
          </div>
        </td>
        <td><b>${e.total} ชิ้น</b></td>
        <td><span style="color: ${e.out > 0 ? "var(--warning)" : "var(--text-muted)"}; font-weight: bold;">${e.out}</span></td>
        <td><span style="color: var(--success); font-weight: bold;">${avail}</span></td>
        <td>
          <div class="stock-ctrl">
            <button class="btn-stock" onclick="window.changeStock('${e.id}', -1)">-</button>
            <button class="btn-stock" onclick="window.changeStock('${e.id}', 1)">+</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* =========================================================
   ADMIN ACTIONS (ปุ่มกดปรับเปลี่ยนและเซฟข้อมูลคลังสต็อกสากล)
========================================================= */
window.changeStock = function (id, amount) {
  const item = EQUIP.find((e) => e.id === id);
  if (!item) return;

  const newTotal = item.total + amount;
  if (newTotal < item.out || newTotal < 0) {
    alert(
      "❌ ไม่สามารถปรับสต็อกรวมให้ต่ำกว่าจำนวนที่เด็กยืมใช้งานอยู่ได้ครับ!",
    );
    return;
  }

  // ส่งข้อมูลปรับสต็อกและสะท้อนค่าจำนวนยืมขึ้นสู่ระบบคลาวด์ล็อกค่าไว้อัตโนมัติ
  update(ref(db, `equipment/${id}`), { total: newTotal, out: item.out });
};

window.addEventListener("DOMContentLoaded", () => {
  listenToFirebaseData();
});
