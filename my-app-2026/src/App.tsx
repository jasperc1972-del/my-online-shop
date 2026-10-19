import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import emailjs, { EmailJSResponseStatus } from '@emailjs/browser'
import './App.css'

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

type Product = {
  id: number
  name: string
  description: string
  price: number
  emoji: string
  tint: string
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: '手沖咖啡豆',
    description: '衣索比亞耶加雪菲，淺焙果香，250g',
    price: 250,
    emoji: '☕',
    tint: '#f6e7d8',
  },
  {
    id: 2,
    name: '無線藍牙耳機',
    description: '主動降噪，續航 30 小時',
    price: 1990,
    emoji: '🎧',
    tint: '#dfe9f7',
  },
  {
    id: 3,
    name: '綠植小盆栽',
    description: '好照顧的龜背芋，附陶瓷盆',
    price: 380,
    emoji: '🪴',
    tint: '#ddf0e1',
  },
]

const currency = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

type PaymentMethod = 'transfer' | 'convenience'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  transfer: '銀行轉帳',
  convenience: '超商付款',
}

type Customer = {
  name: string
  phone: string
  email: string
  address: string
  payment: PaymentMethod
}

const EMPTY_CUSTOMER: Customer = {
  name: '',
  phone: '',
  email: '',
  address: '',
  payment: 'transfer',
}

type OrderLine = { product: Product; qty: number }

type Order = {
  id: string
  lines: OrderLine[]
  total: number
  customer: Customer
}

// 例：ORD-20261019-4821
function createOrderId() {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `ORD-${date}-${rand}`
}

function formatNow() {
  return new Date().toLocaleString('zh-TW')
}

type StepperProps = {
  name: string
  qty: number
  onChange: (qty: number) => void
}

function QuantityStepper({ name, qty, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={`減少 ${name}`}
        onClick={() => onChange(qty - 1)}
      >
        −
      </button>
      <span className="stepper-qty" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        aria-label={`增加 ${name}`}
        onClick={() => onChange(qty + 1)}
      >
        +
      </button>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function App() {
  // 商品 id → 數量；數量歸 0 的商品會直接從物件中移除
  const [cart, setCart] = useState<Record<number, number>>({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [drawerView, setDrawerView] = useState<'cart' | 'checkout'>('cart')
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER)
  const [order, setOrder] = useState<Order | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const productGridRef = useRef<HTMLUListElement>(null)

  const closeOrderModal = () => setOrder(null)

  // 關閉訂單成功彈窗並捲回商品列表
  const continueShopping = () => {
    setOrder(null)
    productGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const setQty = (id: number, qty: number) => {
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  const openCart = () => {
    setDrawerView('cart')
    setIsCartOpen(true)
  }

  // 抽屜或訂單完成畫面開啟時按 Esc 關閉
  useEffect(() => {
    if (!isCartOpen && !order) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (order) setOrder(null)
      else setIsCartOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCartOpen, order])

  const cartItems = PRODUCTS.filter((p) => cart[p.id])
  const totalCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const totalPrice = cartItems.reduce((sum, p) => sum + p.price * cart[p.id], 0)

  const updateField = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setCustomer((prev) => ({ ...prev, [name]: value }))
  }

  const placeOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cartItems.length === 0 || isSending) return
    setSendError(null)

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      setSendError(
        'Email 寄送設定不完整（缺少 EmailJS 環境變數），訂單尚未成立。',
      )
      return
    }

    const newOrder: Order = {
      id: createOrderId(),
      lines: cartItems.map((product) => ({ product, qty: cart[product.id] })),
      total: totalPrice,
      customer,
    }

    // 傳給 EmailJS 範本的變數；範本中以 {{變數名稱}} 使用
    const templateParams = {
      to_email: customer.email,
      to_name: customer.name,
      order_id: newOrder.id,
      order_date: formatNow(),
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      shipping_address: customer.address,
      payment_method: PAYMENT_LABELS[customer.payment],
      order_items: newOrder.lines
        .map(
          ({ product, qty }) =>
            `${product.name} × ${qty}　${currency.format(product.price * qty)}`,
        )
        .join('\n'),
      total_quantity: totalCount,
      total_amount: currency.format(newOrder.total),
    }

    setIsSending(true)
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
        publicKey: EMAILJS_PUBLIC_KEY,
      })
    } catch (err) {
      const detail =
        err instanceof EmailJSResponseStatus
          ? `${err.status} ${err.text}`
          : err instanceof Error
            ? err.message
            : String(err)
      setSendError(
        `訂單確認信寄送失敗，訂單尚未成立，購物車與填寫的資料都已保留，請稍後再試。（錯誤：${detail}）`,
      )
      return
    } finally {
      setIsSending(false)
    }

    setOrder(newOrder)
    setCart({})
    setCustomer(EMPTY_CUSTOMER)
    setIsCartOpen(false)
    setDrawerView('cart')
  }

  return (
    <div className="shop">
      <header className="shop-header">
        <div className="brand">
          <span className="brand-mark">🛍️</span>
          <span>小日子選物</span>
        </div>
        <button
          type="button"
          className="cart-summary"
          aria-label={`開啟購物車，共 ${totalCount} 件，${currency.format(totalPrice)}`}
          aria-expanded={isCartOpen}
          aria-controls="cart-drawer"
          onClick={openCart}
        >
          <span className="cart-icon" aria-hidden="true">
            🛒
            {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
          </span>
          <span className="cart-text" aria-live="polite">
            <span className="cart-count">{totalCount} 件商品</span>
            <strong className="cart-total">{currency.format(totalPrice)}</strong>
          </span>
        </button>
      </header>

      <section className="intro">
        <h1>本週精選</h1>
        <p>挑幾樣喜歡的，讓日常多一點好心情。</p>
      </section>

      <ul className="product-grid" ref={productGridRef}>
        {PRODUCTS.map((product) => {
          const qty = cart[product.id] ?? 0
          return (
            <li key={product.id} className="product-card">
              <div
                className="product-image"
                style={{ '--tint': product.tint } as CSSProperties}
              >
                <span aria-hidden="true">{product.emoji}</span>
              </div>
              <div className="product-body">
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <div className="product-footer">
                  <span className="price">{currency.format(product.price)}</span>
                  {qty === 0 ? (
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => setQty(product.id, 1)}
                    >
                      加入購物車
                    </button>
                  ) : (
                    <QuantityStepper
                      name={product.name}
                      qty={qty}
                      onChange={(n) => setQty(product.id, n)}
                    />
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div
        className={`drawer-backdrop${isCartOpen ? ' open' : ''}`}
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="cart-drawer"
        className={`cart-drawer${isCartOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        inert={!isCartOpen}
      >
        <div className="drawer-header">
          {drawerView === 'checkout' && (
            <button
              type="button"
              className="icon-button"
              aria-label="返回購物車"
              onClick={() => setDrawerView('cart')}
            >
              ←
            </button>
          )}
          <h2 id="cart-drawer-title">
            {drawerView === 'cart' ? '購物車' : '填寫結帳資料'}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="關閉購物車"
            onClick={() => setIsCartOpen(false)}
          >
            ✕
          </button>
        </div>

        {drawerView === 'cart' ? (
          <>
            {cartItems.length === 0 ? (
              <div className="drawer-empty">
                <span aria-hidden="true">🛒</span>
                <p>購物車是空的</p>
              </div>
            ) : (
              <ul className="drawer-items">
                {cartItems.map((product) => (
                  <li key={product.id} className="drawer-item">
                    <span
                      className="drawer-thumb"
                      style={{ '--tint': product.tint } as CSSProperties}
                      aria-hidden="true"
                    >
                      {product.emoji}
                    </span>
                    <div className="drawer-item-info">
                      <strong>{product.name}</strong>
                      <span>{currency.format(product.price)}</span>
                      <QuantityStepper
                        name={product.name}
                        qty={cart[product.id]}
                        onChange={(n) => setQty(product.id, n)}
                      />
                    </div>
                    <div className="drawer-item-side">
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`刪除 ${product.name}`}
                        onClick={() => setQty(product.id, 0)}
                      >
                        <TrashIcon />
                      </button>
                      <strong className="subtotal">
                        {currency.format(product.price * cart[product.id])}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="drawer-footer">
              <div className="drawer-total">
                <span>合計（{totalCount} 件）</span>
                <strong>{currency.format(totalPrice)}</strong>
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={cartItems.length === 0}
                onClick={() => setDrawerView('checkout')}
              >
                前往結帳
              </button>
              <button
                type="button"
                className="clear-button"
                disabled={cartItems.length === 0}
                onClick={() => setCart({})}
              >
                清空購物車
              </button>
            </div>
          </>
        ) : (
          <form className="checkout-form" onSubmit={placeOrder}>
            <div className="checkout-fields">
              <label className="field">
                <span>收件人姓名</span>
                <input
                  name="name"
                  value={customer.name}
                  onChange={updateField}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="field">
                <span>聯絡電話</span>
                <input
                  name="phone"
                  type="tel"
                  value={customer.phone}
                  onChange={updateField}
                  autoComplete="tel"
                  placeholder="0912345678"
                  pattern="09\d{8}"
                  title="請輸入 09 開頭的 10 碼手機號碼"
                  required
                />
              </label>
              <label className="field">
                <span>電子郵件 (Email)</span>
                <input
                  name="email"
                  type="email"
                  value={customer.email}
                  onChange={updateField}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="field">
                <span>收件地址</span>
                <textarea
                  name="address"
                  rows={2}
                  value={customer.address}
                  onChange={updateField}
                  autoComplete="street-address"
                  required
                />
              </label>
              <fieldset className="field payment-options">
                <legend>付款方式</legend>
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((key) => (
                  <label key={key} className="payment-option">
                    <input
                      type="radio"
                      name="payment"
                      value={key}
                      checked={customer.payment === key}
                      onChange={updateField}
                    />
                    <span>{PAYMENT_LABELS[key]}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="drawer-footer">
              {sendError && (
                <p className="form-error" role="alert">
                  {sendError}
                </p>
              )}
              <div className="drawer-total">
                <span>應付金額（{totalCount} 件）</span>
                <strong>{currency.format(totalPrice)}</strong>
              </div>
              <button
                type="submit"
                className="primary-button"
                disabled={isSending}
              >
                {isSending ? '正在寄送訂單確認信…' : '確認下單'}
              </button>
            </div>
          </form>
        )}
      </aside>

      {order && (
        <div className="modal-backdrop" onClick={closeOrderModal}>
          <div
            className="order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button modal-close"
              aria-label="關閉訂單成功視窗"
              onClick={closeOrderModal}
            >
              ✕
            </button>
            <h2 id="order-modal-title">🎉 訂單已成功建立！</h2>
            <p className="order-id">
              訂單編號：<strong>{order.id}</strong>
            </p>

            <ul className="order-lines">
              {order.lines.map(({ product, qty }) => (
                <li key={product.id}>
                  <span>
                    {product.emoji} {product.name} × {qty}
                  </span>
                  <span>{currency.format(product.price * qty)}</span>
                </li>
              ))}
            </ul>
            <div className="order-total">
              <span>合計（{PAYMENT_LABELS[order.customer.payment]}）</span>
              <strong>{currency.format(order.total)}</strong>
            </div>

            <p className="order-notice">
              訂單確認信已寄至：<strong>{order.customer.email}</strong>
              。若沒有在收件匣看到，請檢查垃圾郵件匣。
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeOrderModal}
              >
                關閉
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={continueShopping}
              >
                繼續逛逛
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
