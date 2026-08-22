import asyncio
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, Role
from app.models.catalog import Category, Product
from app.models.store import Store, Inventory
from app.models.pickup_slot import PickupSlot
from app.models.order import Order, OrderItem, OrderStatus, FulfillmentType, OrderStatusLog

async def seed(db: Optional[AsyncSession] = None):
    if db is not None:
        await _run_seed(db)
    else:
        async with AsyncSessionLocal() as db_session:
            await _run_seed(db_session)

async def _run_seed(db: AsyncSession):
    print("[SEED] Starting Mini D-Mart Database Seeding (1,050+ Products)...")

    # 1. Clean up catalog & order tables
    print("  - Cleaning up old catalog & order tables...")
    await db.execute(text("DELETE FROM return_requests;"))
    await db.execute(text("DELETE FROM order_status_logs;"))
    await db.execute(text("DELETE FROM order_items;"))
    await db.execute(text("DELETE FROM orders;"))
    await db.execute(text("DELETE FROM cart_items;"))
    await db.execute(text("DELETE FROM inventory;"))
    await db.execute(text("DELETE FROM products;"))
    await db.execute(text("DELETE FROM categories;"))
    await db.commit()

    # 2. Seed Admin User
    admin_email = "admin@minidmart.com"
    result = await db.execute(select(User).where(User.email == admin_email))
    admin = result.scalar_one_or_none()
    if not admin:
        admin = User(
            email=admin_email,
            password_hash=get_password_hash("Admin@123"),
            name="System Administrator",
            phone="+919876543210",
            role=Role.ADMIN,
            is_active=True,
        )
        db.add(admin)
        print("  + Created Admin User (admin@minidmart.com)")
    else:
        admin.password_hash = get_password_hash("Admin@123")
        admin.is_active = True

    # 3. Seed Staff User
    staff_email = "staff@minidmart.com"
    res_staff = await db.execute(select(User).where(User.email == staff_email))
    staff = res_staff.scalar_one_or_none()
    if not staff:
        staff = User(
            email=staff_email,
            password_hash=get_password_hash("Staff@123"),
            name="Store Fulfillment Staff",
            phone="+919876543211",
            role=Role.STAFF,
            is_active=True,
        )
        db.add(staff)
        print("  + Created Staff User (staff@minidmart.com)")
    else:
        staff.password_hash = get_password_hash("Staff@123")
        staff.is_active = True

    # Seed Customer Users
    customer_users = [
        ("customer@minidmart.com", "Customer@123", "Priya Sharma", "+919876543212"),
        ("end2end_customer@example.com", "Password123", "Rahul Verma", "+919876543213")
    ]
    for c_email, c_pass, c_name, c_phone in customer_users:
        res_c = await db.execute(select(User).where(User.email == c_email))
        cust = res_c.scalar_one_or_none()
        if not cust:
            cust = User(
                email=c_email,
                password_hash=get_password_hash(c_pass),
                name=c_name,
                phone=c_phone,
                role=Role.CUSTOMER,
                is_active=True,
            )
            db.add(cust)
            print(f"  + Created Customer User ({c_email})")
        else:
            cust.password_hash = get_password_hash(c_pass)
            cust.is_active = True

    # 4. Seed Categories
    categories_data = [
        {"name": "Fruits & Vegetables", "slug": "fruits-vegetables"},
        {"name": "Dairy & Bakery", "slug": "dairy-bakery"},
        {"name": "Snacks & Beverages", "slug": "snacks-beverages"},
        {"name": "Instant & Frozen Food", "slug": "instant-frozen-food"},
        {"name": "Munchies & Chips", "slug": "munchies-chips"},
        {"name": "Personal Care", "slug": "personal-care"},
        {"name": "Household Essentials", "slug": "household-essentials"},
        {"name": "Raksha Bandhan Specials", "slug": "raksha-bandhan"},
        {"name": "Cooking Essentials", "slug": "cooking-essentials"},
        {"name": "Dry Fruits & Nuts", "slug": "dry-fruits-nuts"},
        {"name": "Pulses & Grains", "slug": "pulses-grains"},
        {"name": "Breakfast & Cereals", "slug": "breakfast-cereals"},
        {"name": "Baby Care", "slug": "baby-care"},
        {"name": "Health & Wellness", "slug": "health-wellness"},
        {"name": "Pet Care", "slug": "pet-care"},
    ]
    category_map = {}
    for cat_info in categories_data:
        cat = Category(name=cat_info["name"], slug=cat_info["slug"])
        db.add(cat)
        await db.flush()
        print(f"  + Created Category: {cat_info['name']}")
        category_map[cat_info["slug"]] = cat

    # 5. Seed Store
    res = await db.execute(select(Store).where(Store.name == "Mini D-Mart Central Store"))
    store = res.scalar_one_or_none()
    if not store:
        store = Store(
            name="Mini D-Mart Central Store",
            address="Plot 42, Sector 18, Vashi, Navi Mumbai, Maharashtra 400703",
            pickup_capacity_per_slot=15,
        )
        db.add(store)
        await db.flush()
        print("  + Created Store: Mini D-Mart Central Store")

    # Define 350 base product templates (50 items x 7 categories)
    # Each item has 3 size variants = 1,050 total products
    product_templates = {
        "fruits-vegetables": [
            ("Ratnagiri Alphonso Mango", "Sweet, aromatic, and rich Ratnagiri Alphonso mangoes.", "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80", 150.00, ["250 g", "500 g", "1 kg"]),
            ("Organic Red Tomatoes", "Farm-fresh juicy organic red tomatoes.", "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80", 25.00, ["250 g", "500 g", "1 kg"]),
            ("Robusta Bananas", "Sweet and energy-rich Cavendish Robusta bananas.", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80", 30.00, ["3 pcs", "6 pcs", "1 Dozen"]),
            ("Fresh Spinach (Palak)", "Crispy green spinach leaves, cleaned and washed.", "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 15.00, ["100 g", "250 g", "500 g"]),
            ("Hybrid Red Onions", "High-quality farm red onions with a crisp texture.", "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80", 20.00, ["500 g", "1 kg", "2 kg"]),
            ("New Crop Potatoes", "Freshly harvested earthy potatoes, perfect for boiling/frying.", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80", 18.00, ["500 g", "1 kg", "2 kg"]),
            ("Fresh Cauliflower", "Clean white cauliflower heads, rich in nutrients.", "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80", 22.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Local Red Carrots", "Sweet and crunchy local red carrots.", "https://images.unsplash.com/photo-1582515073490-39981397c445?auto=format&fit=crop&w=600&q=80", 20.00, ["250 g", "500 g", "1 kg"]),
            ("Green Capsicum", "Glossy and crisp green bell peppers.", "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80", 24.00, ["200 g", "500 g", "1 kg"]),
            ("Ripe Semi-Sweet Papaya", "Fresh and juicy sunrise papaya, high in antioxidants.", "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?auto=format&fit=crop&w=600&q=80", 38.00, ["1 pc (approx 700g)", "1 pc (approx 1.2kg)", "2 pcs"]),
            ("Juicy Yellow Lemons", "Tangy, freshly picked sour lemons packed with Vitamin C.", "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=600&q=80", 15.00, ["4 pcs", "8 pcs", "12 pcs"]),
            ("Ruby Red Pomegranate", "Seed-rich ruby red pomegranates, sweet and antioxidant rich.", "https://images.unsplash.com/photo-1541344999736-83eca272f6fc?auto=format&fit=crop&w=600&q=80", 95.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Royal Gala Apples", "Crisp, sweet, and juicy imported Royal Gala apples.", "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80", 110.00, ["500 g", "1 kg", "2 kg"]),
            ("Nagpur Sweet Oranges", "Citrusy, sweet and refreshing Nagpur oranges.", "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80", 45.00, ["500 g", "1 kg", "2 kg"]),
            ("Crunchy English Cucumber", "Hydrating and refreshing salad cucumber.", "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=600&q=80", 18.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Ginger (Adrak)", "Spicy and aromatic fresh washed ginger root.", "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80", 25.00, ["100 g", "250 g", "500 g"]),
            ("Desi Garlic (Lahsun)", "Pungent and flavorful garlic cloves with firm bulbs.", "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=600&q=80", 35.00, ["100 g", "250 g", "500 g"]),
            ("Tender Lady Finger (Bhindi)", "Fresh, green, and tender okra pods.", "https://images.unsplash.com/photo-1564758564527-b97d79cb27c1?auto=format&fit=crop&w=600&q=80", 22.00, ["250 g", "500 g", "1 kg"]),
            ("Sweet Watermelon", "Juicy, crisp, and refreshing dark green watermelon.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 55.00, ["1 pc (approx 2kg)", "1 pc (approx 3.5kg)", "2 pcs"]),
            ("Queen Pineapple", "Aromatic sweet and tangy golden pineapple.", "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80", 48.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Fresh Green Peas (Matar)", "Sweet green peas in tender pods, freshly harvested.", "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&w=600&q=80", 30.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Button Mushrooms", "Plump and white button mushrooms, hygienically packed.", "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?auto=format&fit=crop&w=600&q=80", 45.00, ["200 g pack", "400 g pack", "600 g pack"]),
            ("Fresh Tender Coconut", "Naturally sweet coconut water from fresh coastal coconuts.", "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80", 40.00, ["1 pc", "2 pcs", "4 pcs"]),
            ("American Sweetcorn", "Tender and sweet golden corn on the cob.", "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80", 20.00, ["1 pc", "2 pcs", "4 pcs"]),
            ("Green Broccoli Florets", "Nutrient-dense, fresh, crisp broccoli florets.", "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=600&q=80", 45.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Beetroot", "Earthy and vibrant dark red beetroot.", "https://images.unsplash.com/photo-1528751014936-863e6e7a319c?auto=format&fit=crop&w=600&q=80", 22.00, ["250 g", "500 g", "1 kg"]),
            ("White Mooli (Radish)", "Crispy and peppery white radish roots.", "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?auto=format&fit=crop&w=600&q=80", 18.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Coriander Leaves", "Aromatic fresh green coriander bunch for garnishing.", "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80", 10.00, ["100 g", "250 g", "500 g"]),
            ("Fresh Pudina (Mint)", "Cooling and refreshing organic mint leaves.", "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=600&q=80", 12.00, ["100 g", "250 g", "500 g"]),
            ("Spicy Green Chillies", "Fiery and fresh hot green chillies.", "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80", 15.00, ["100 g", "250 g", "500 g"]),
            ("Fragrant Curry Leaves", "Aromatic fresh green kadi patta leaves.", "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80", 8.00, ["50 g", "100 g", "200 g"]),
            ("Tender Bottle Gourd (Lauki)", "Fresh and light bottle gourd, great for curries and juices.", "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=600&q=80", 25.00, ["1 pc (500g)", "1 pc (1kg)", "2 pcs"]),
            ("Bitter Gourd (Karela)", "Crisp and fresh green bitter melon.", "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=600&q=80", 24.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Ridge Gourd (Turai)", "Tender and sweet-fleshed ridge gourd.", "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=600&q=80", 26.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Drumsticks", "Nutrient-packed green drumstick pods for sambar and curries.", "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=600&q=80", 20.00, ["4 pcs", "8 pcs", "12 pcs"]),
            ("Purple Eggplant (Brinjal)", "Glossy and tender purple baingan for bharta and roasting.", "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=600&q=80", 22.00, ["250 g", "500 g", "1 kg"]),
            ("Crisp Green Cabbage", "Freshly harvested tight green cabbage head.", "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?auto=format&fit=crop&w=600&q=80", 18.00, ["1 pc (approx 500g)", "1 pc (approx 1kg)", "2 pcs"]),
            ("Sweet Sweet Potatoes (Shakarkand)", "Naturally sweet root vegetables, ideal for roasting.", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", 28.00, ["250 g", "500 g", "1 kg"]),
            ("Tangy Raw Mango (Kairi)", "Sour green raw mangoes for pickles and chutney.", "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80", 35.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Taiwan Guava", "Crunchy and sweet white-fleshed guava.", "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80", 40.00, ["500 g", "1 kg", "2 kg"]),
            ("Sweet Custard Apple (Sitaphal)", "Creamy and fragrant seasonal custard apples.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 75.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Exotic Dragon Fruit", "Vibrant pink pitaya fruit with sweet speckled pulp.", "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80", 65.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Imported Green Kiwi", "Tangy and sweet Vitamin-C rich kiwi fruit.", "https://images.unsplash.com/photo-1585059895524-72359e06133a?auto=format&fit=crop&w=600&q=80", 70.00, ["3 pcs pack", "6 pcs pack", "9 pcs pack"]),
            ("Mahabaleshwar Strawberries", "Juicy and aromatic fresh red strawberries.", "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80", 80.00, ["200 g box", "400 g box", "600 g box"]),
            ("Fresh Blueberries", "Plump, sweet antioxidant powerhouse blueberries.", "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=600&q=80", 120.00, ["125 g pack", "250 g pack", "375 g pack"]),
            ("Fresh Sweet Lime (Mosambi)", "Juicy and refreshing sweet limes.", "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80", 45.00, ["500 g", "1 kg", "2 kg"]),
            ("Sweet Sapota (Chiku)", "Soft, caramel-sweet brown sapota.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 35.00, ["500 g", "1 kg", "2 kg"]),
            ("Fragrant Muskmelon (Kharbuja)", "Sweet and juicy orange-fleshed muskmelon.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 45.00, ["1 pc (approx 1kg)", "1 pc (approx 1.5kg)", "2 pcs"]),
            ("Hass Avocado", "Creamy, rich and buttery ripe Hass avocados.", "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80", 90.00, ["1 pc", "2 pcs", "4 pcs"]),
            ("Baby Spinach Leaves", "Tender baby spinach leaves, ideal for salads and smoothies.", "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 25.00, ["100 g", "250 g", "500 g"]),
        ],
        "dairy-bakery": [
            ("Amul Pasteurised Butter", "Rich and creamy classic salted butter.", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80", 54.00, ["100 g", "250 g", "500 g"]),
            ("Mother Dairy Full Cream Milk", "Fresh pasteurised homogenised full cream pouch milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 33.00, ["500 ml", "1 L", "2 L"]),
            ("Britannia 100% Whole Wheat Bread", "Nutritious whole wheat sliced sandwich bread.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 45.00, ["200 g", "400 g", "600 g"]),
            ("Amul Fresh Malai Paneer", "Soft, spongy, and rich block of fresh cottage cheese.", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", 85.00, ["100 g", "200 g", "500 g"]),
            ("Epigamia Greek Yogurt (Blueberry)", "High protein thick Greek yogurt flavored with real berries.", "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80", 50.00, ["85 g", "100 g", "200 g"]),
            ("Amul Pure Desi Ghee", "Traditional golden granulated cow ghee.", "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80", 295.00, ["200 ml", "500 ml", "1 L"]),
            ("Amul Processed Cheese Slices", "Individually wrapped creamy cheese slices.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80", 80.00, ["100 g (5 slices)", "200 g (10 slices)", "400 g (20 slices)"]),
            ("Mother Dairy Classic Dahi", "Creamy, naturally set classic curd.", "https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&w=600&q=80", 35.00, ["200 g", "400 g", "1 kg"]),
            ("Farm Fresh White Eggs", "Protein-rich farm fresh washed white table eggs.", "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80", 42.00, ["6 pcs", "12 pcs", "30 pcs (Tray)"]),
            ("Amul Masti Spiced Buttermilk", "Cooling probiotic masala chaas with cumin and ginger.", "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", 15.00, ["200 ml", "500 ml", "1 L"]),
            ("Nestle Milkmaid Sweetened Condensed Milk", "Rich and creamy sweetened condensed milk for desserts.", "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80", 145.00, ["200 g", "400 g", "800 g"]),
            ("Britannia Choco Chill Muffins", "Soft and moist chocolate muffins loaded with chocochips.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 30.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Artisan Garlic Toast Loaf", "Freshly baked herb and garlic infused crusty bread.", "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80", 55.00, ["200 g", "400 g", "600 g"]),
            ("Britannia Toastea Premium Rusk", "Crunchy and crispy twice-baked wheat tea rusks.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 40.00, ["150 g", "300 g", "600 g"]),
            ("Aashirvaad Shudh Chakki Atta", "100% pure whole wheat stone-ground flour with natural dietary fiber.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 220.00, ["1 kg", "5 kg", "10 kg"]),
            ("Amul Vanilla Magic Ice Cream", "Classic creamy vanilla flavored frozen dessert.", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80", 110.00, ["500 ml", "1 L", "2 L"]),
            ("Amul Mozzarella Pizza Cheese", "Finely grated melt-in-mouth stretchy pizza cheese.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80", 125.00, ["200 g", "500 g", "1 kg"]),
            ("Amul Processed Cheese Cubes", "Rich and creamy bite-sized cheese cubes.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80", 90.00, ["100 g (4 cubes)", "200 g (8 cubes)", "500 g (20 cubes)"]),
            ("Amul Taaza Homogenised Toned Milk", "Nutritious and fresh long-life toned milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 27.00, ["500 ml", "1 L", "2 L"]),
            ("Amul Gold Special Milk", "Rich and creamy 6% fat premium milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 34.00, ["500 ml", "1 L", "2 L"]),
            ("Mother Dairy Cow Milk", "Easily digestible and pure cow milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 28.00, ["500 ml", "1 L", "2 L"]),
            ("D'lecta Cream Cheese", "Smooth and creamy spreadable cream cheese.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80", 130.00, ["150 g", "200 g", "400 g"]),
            ("Amul Fresh Cream", "Rich 25% milk fat whipping and cooking cream.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 65.00, ["200 ml", "500 ml", "1 L"]),
            ("Cavins Chocolate Flavoured Milk", "Delicious thick chocolate milk shake.", "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", 35.00, ["200 ml", "500 ml", "1 L"]),
            ("Amul Kool Mango Flavoured Milk", "Sweet and refreshing mango milk shake.", "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", 25.00, ["180 ml", "360 ml", "720 ml"]),
            ("Mother Dairy Sweet Lassi", "Thick and refreshing traditional sweet yogurt drink.", "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", 20.00, ["200 ml", "500 ml", "1 L"]),
            ("Modern Multigrain Sliced Bread", "Fiber-rich sandwich loaf with wholesome grains.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 50.00, ["200 g", "400 g", "600 g"]),
            ("English Oven Brown Bread", "Soft sliced wholesome brown bread.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 45.00, ["200 g", "400 g", "600 g"]),
            ("Fresh Pav Buns (Ladi Pav)", "Pillowy soft traditional bakery ladi pav.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 25.00, ["6 pcs", "12 pcs", "18 pcs"]),
            ("English Oven Burger Buns", "Soft sesame topped round burger buns.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 35.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Fresh Pizza Base (2 pcs)", "Soft and airy ready-to-bake pizza bases.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 38.00, ["200 g (2 pcs)", "400 g (4 pcs)", "600 g (6 pcs)"]),
            ("Butter French Croissant", "Flaky and buttery layered European-style croissant.", "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80", 45.00, ["1 pc", "2 pcs", "4 pcs"]),
            ("Britannia Pure Magic Choco Cookies", "Crispy chocolate cookies filled with rich chocolate cream.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 40.00, ["75 g", "150 g", "300 g"]),
            ("Rich Chocolate Truffle Cake", "Decadent chocolate sponge layered with dark chocolate ganache.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 299.00, ["250 g", "500 g", "1 kg"]),
            ("English Fruit Cake", "Moist vanilla pound cake loaded with candied fruits.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "300 g", "600 g"]),
            ("Kwality Wall's Butterscotch Tub", "Crunchy cashew praline and butterscotch ice cream.", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80", 140.00, ["500 ml", "1 L", "2 L"]),
            ("Amul Alphonso Mango Ice Cream", "Rich ice cream made with real Alphonso mango pulp.", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80", 130.00, ["500 ml", "1 L", "2 L"]),
            ("Haldiram Gulab Jamun Tin", "Soft, melt-in-mouth fried milk dumplings in cardamom sugar syrup.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 125.00, ["500 g", "1 kg", "2 kg"]),
            ("Haldiram Rasgulla Tin", "Spongy and juicy cottage cheese spheres in light sugar syrup.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 120.00, ["500 g", "1 kg", "2 kg"]),
            ("Haldiram Kaju Katli Box", "Premium cashew fudge squares with silver vark.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 250.00, ["200 g", "400 g", "800 g"]),
            ("Besan Ladoo Box", "Aromatic gram flour sweets made with pure ghee and dry fruits.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 160.00, ["200 g", "400 g", "800 g"]),
            ("Fresh Mawa / Khoya", "Pure unsweetened evaporated milk solids for sweets.", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", 110.00, ["200 g", "500 g", "1 kg"]),
            ("Sofit Soya Milk (Vanilla)", "Lactose-free, high-protein vanilla flavored soy beverage.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 45.00, ["200 ml", "1 L", "2 L"]),
            ("Raw Pressery Almond Milk (Unsweetened)", "Dairy-free creamy vegan almond milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 95.00, ["200 ml", "1 L", "2 L"]),
            ("Oatly Oat Drink (Original)", "Rich and creamy plant-based oat milk.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 140.00, ["250 ml", "1 L", "2 L"]),
            ("Amul Unsalted Butter (Cooking)", "Pure unsalted butter block for baking and gourmet cooking.", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80", 56.00, ["100 g", "500 g", "1 kg"]),
            ("Nutty Gourmet Peanut Butter (Creamy)", "High-protein slow-roasted peanut butter.", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80", 140.00, ["250 g", "500 g", "1 kg"]),
            ("D'lecta Table Butter", "Farm fresh pasteurised table butter.", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80", 52.00, ["100 g", "250 g", "500 g"]),
            ("Heritage Paneer", "Fresh and soft cow milk paneer cubes.", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", 80.00, ["100 g", "200 g", "500 g"]),
            ("Amul Mithai Mate", "Rich dessert enhancer condensed milk.", "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80", 60.00, ["200 g", "400 g", "800 g"]),
        ],
        "snacks-beverages": [
            ("Tata Tea Gold Premium", "Exquisite blend of CTC tea and long leaves for rich aroma.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 140.00, ["250 g", "500 g", "1 kg"]),
            ("Coca-Cola Original Taste", "Refreshing and fizzy classic sparkling soft drink.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml (Can)", "750 ml (Bottle)", "2.25 L"]),
            ("Nescafe Classic Instant Coffee", "100% pure instant coffee made with handpicked Robusta beans.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 165.00, ["50 g jar", "100 g jar", "200 g jar"]),
            ("Real Fruit Power Mixed Fruit", "Wholesome fruit beverage with the goodness of 9 fruits.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 110.00, ["200 ml (Tetra)", "1 L (Tetra)", "2 L"]),
            ("Red Bull Energy Drink", "Vitalizes body and mind with caffeine, taurine, and B-vitamins.", "https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80", 125.00, ["250 ml (Can)", "350 ml (Can)", "4-pack"]),
            ("Paper Boat Aamras", "Thick and authentic mango beverage with nostalgia in every sip.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 35.00, ["200 ml pouch", "500 ml", "1 L"]),
            ("Pepsi Sparkling Cola", "Crisp, refreshing carbonated cola beverage.", "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Tropicana 100% Orange Juice", "No added sugar pure orange juice packed with natural Vitamin C.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 120.00, ["200 ml", "1 L", "2 L"]),
            ("Brooke Bond Taj Mahal Tea", "Master blend of rich Assam leaves with unforgettable taste.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 185.00, ["250 g", "500 g", "1 kg"]),
            ("Cadbury Bournvita Chocolate Drink", "Inner strength formula malted chocolate health beverage.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 230.00, ["500 g jar", "1 kg refill", "2 kg jar"]),
            ("Sprite Lemon-Lime Soda", "Clear, crisp, and refreshing citrus carbonated drink.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Minute Maid Pulpy Orange", "Refreshing orange drink loaded with real fruit pulp.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 42.00, ["250 ml", "1 L", "1.75 L"]),
            ("Lipton Pure & Light Green Tea", "Calorie-free refreshing natural green tea bags.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 150.00, ["25 bags", "50 bags", "100 bags"]),
            ("Boost Energy & Stamina Health Drink", "Malted food drink clinically proven to increase stamina 3x.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 240.00, ["500 g jar", "1 kg refill", "2 kg jar"]),
            ("Fanta Orange Flavoured Drink", "Bright, bubbly, and fruity orange carbonated beverage.", "https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Appy Fizz Sparkling Apple Juice", "Crisp and tangy sparkling apple flavored beverage.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 38.00, ["250 ml (Can)", "600 ml (Pet)", "1.5 L"]),
            ("Brooke Bond Red Label Tea", "Rich flavor and bright liquor tea blend.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 135.00, ["250 g", "500 g", "1 kg"]),
            ("Horlicks Classic Malt Health Drink", "Clinically proven malt nutrition drink for growth.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 245.00, ["500 g jar", "1 kg refill", "2 kg jar"]),
            ("Thums Up Strong Taste Cola", "Charged and fizzy thunderous Indian cola drink.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Monster Energy Drink (Original)", "High caffeine energy beverage for intense focus.", "https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80", 125.00, ["350 ml (Can)", "500 ml (Can)", "4-pack"]),
            ("Bru Instant Coffee Powder", "Fine blend of 70% coffee and 30% chicory.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 120.00, ["50 g", "100 g", "200 g"]),
            ("Britannia Marie Gold Biscuits", "Crisp, light, and healthy tea-time tea dipping biscuits.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 35.00, ["150 g", "300 g", "600 g"]),
            ("Diet Coke No Sugar", "Zero calorie sparkling crisp cola beverage.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["300 ml (Can)", "750 ml (Bottle)", "6-pack"]),
            ("7UP Lemon Lime Refreshment", "Clear bubbly refreshing lemon soda.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Limca Fresh Lemon Fizz", "Tangy, bubbly and cloudy lemon lime soda.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Mountain Dew Citrus Soda", "High-energy citrus sparkling beverage.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Maaza Mango Drink", "Rich, thick, and sweet Alphonso mango pulp juice.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 38.00, ["250 ml", "600 ml", "1.2 L"]),
            ("Slice Thick Mango Drink", "Juicy and indulgent sweet mango beverage.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 38.00, ["250 ml", "600 ml", "1.2 L"]),
            ("Mirinda Orange Fizz", "Fruity, tangy, and bubbly sparkling orange soda.", "https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Sting Energy Drink", "Electrifying sweet berry flavored energy drink.", "https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80", 20.00, ["250 ml (Pet)", "500 ml", "1 L"]),
            ("Gatorade Blue Bolt Electrolyte", "Rehydrating isotonic sports drink for athletes.", "https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80", 50.00, ["500 ml", "1 L", "1.5 L"]),
            ("Real Guava Fruit Beverage", "Thick and aromatic pink guava nectar.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 110.00, ["200 ml", "1 L", "2 L"]),
            ("Tropicana Apple Juice", "100% crisp apple juice with no added sugar.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 120.00, ["200 ml", "1 L", "2 L"]),
            ("Paper Boat Jaljeera", "Tangy and digestive cumin-mint spice cooler.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 35.00, ["200 ml", "500 ml", "1 L"]),
            ("Wagh Bakri Premium Leaf Tea", "Strong and flavorful Gujarati tea blend.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 145.00, ["250 g", "500 g", "1 kg"]),
            ("Society Tea Masala Flavour", "Strong tea leaves blended with cardamom, clove and cinnamon.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 155.00, ["250 g", "500 g", "1 kg"]),
            ("Sleepy Owl Cold Brew (Mocha)", "Smooth and bold ready-to-drink artisanal cold brew.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 99.00, ["200 ml", "400 ml", "600 ml"]),
            ("Nescafe Gold Blend Coffee", "Crafted with premium mountain-grown Arabica beans.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 320.00, ["50 g", "100 g", "200 g"]),
            ("Tata Coffee Grand", "Flavour-locked coffee granules with rich taste.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 140.00, ["50 g", "100 g", "200 g"]),
            ("Complan Royale Chocolate", "Nutritious health drink with 34 vital nutrients.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 280.00, ["500 g", "1 kg", "2 kg"]),
            ("Hershey's Hot Chocolate Mix", "Rich European style cocoa powder for hot milk.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 180.00, ["200 g", "400 g", "800 g"]),
            ("Raw Pressery Pure Coconut Water", "100% naturally extracted tender coconut water.", "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80", 60.00, ["200 ml", "500 ml", "1 L"]),
            ("Schweppes Ginger Ale", "Crisp and effervescent sparkling ginger beverage.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 60.00, ["300 ml (Can)", "600 ml", "1.2 L"]),
            ("Schweppes Tonic Water", "Classic quinine tonic mixer for mocktails.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 60.00, ["300 ml (Can)", "600 ml", "1.2 L"]),
            ("Frooti Fresh 'N' Juicy", "Iconic sweet mango nectar in tetra pack.", "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80", 20.00, ["160 ml", "600 ml", "1.2 L"]),
            ("B Natural Mixed Fruit Nectar", "Made from 100% Indian fruit pulp with Vitamin C.", "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80", 105.00, ["200 ml", "1 L", "2 L"]),
            ("Hershey's Chocolate Syrup", "Rich, velvety chocolate syrup for milk, ice cream and pancakes.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 115.00, ["200 g", "623 g", "1.3 kg"]),
            ("Kinley Club Soda", "Extra effervescent crisp sparkling carbonated water.", "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=600&q=80", 20.00, ["750 ml", "1.25 L", "2 L"]),
            ("Bisleri Packaged Drinking Water", "Purified mineral water with essential minerals.", "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", 20.00, ["1 L", "2 L", "5 L (Can)"]),
            ("Yakult Probiotic Fermented Drink", "Probiotic drink with billions of Lactobacillus casei Shirota.", "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", 80.00, ["5-pack (325ml)", "10-pack (650ml)", "15-pack"]),
        ],
        "instant-frozen-food": [
            ("Maggi 2-Minute Masala Noodles", "Classic favorite instant noodles with authentic tastemaker spices.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 14.00, ["70 g (1 pc)", "280 g (4 pack)", "560 g (8 pack)"]),
            ("McCain French Fries", "Crispy golden french fries made from select potatoes.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 115.00, ["200 g", "420 g", "750 g"]),
            ("Knorr Sweet Corn Veg Soup", "Warm, soothing, and sweet restaurant-style corn soup.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 45.00, ["43 g (2 serves)", "86 g (4 serves)", "172 g (8 serves)"]),
            ("Safal Frozen Green Peas", "Tender sweet green peas frozen with IQF technology.", "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&w=600&q=80", 90.00, ["200 g", "500 g", "1 kg"]),
            ("Sunfeast Yippee! Magic Masala", "Non-sticky round instant noodles with colorful veggies.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 15.00, ["65 g (1 pc)", "260 g (4 pack)", "520 g (8 pack)"]),
            ("Ching's Secret Schezwan Noodles", "Fiery Desi Chinese noodles packed with garlic & red chillies.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 18.00, ["60 g", "240 g (4 pack)", "480 g (8 pack)"]),
            ("Haldiram Punjabi Samosas (Frozen)", "Crispy spiced potato & green pea stuffed golden triangles.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 160.00, ["4 pcs (240g)", "8 pcs (480g)", "12 pcs (720g)"]),
            ("Real Good Crispy Chicken Nuggets", "Tender and crunchy breaded chicken finger bites.", "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80", 185.00, ["250 g", "500 g", "1 kg"]),
            ("McCain Chilli Garlic Potato Bites", "Crisp potato nuggets seasoned with chilli flakes and garlic.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 110.00, ["200 g", "420 g", "750 g"]),
            ("MTR Instant Rava Idli Mix", "Quick and fluffy semolina idlis ready in 15 minutes.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 95.00, ["200 g", "500 g", "1 kg"]),
            ("Act II Butter Delite Popcorn", "Freshly popped hot buttered corn in under 3 minutes.", "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80", 35.00, ["33 g (1 bag)", "99 g (3 bags)", "198 g (6 bags)"]),
            ("McCain Smiles Crispy Mashed Potatoes", "Happy smiling face crispy mashed potato shapes.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 130.00, ["200 g", "415 g", "750 g"]),
            ("Safal American Frozen Sweetcorn", "Plump and juicy golden sweet corn kernels.", "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80", 85.00, ["200 g", "500 g", "1 kg"]),
            ("Knorr Classic Tomato Chatpata Soup", "Tangy and savory spiced red tomato soup.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 45.00, ["53 g", "106 g", "212 g"]),
            ("Ching's Secret Manchow Soup", "Hot and spicy Indo-Chinese vegetable soup mix.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 50.00, ["55 g", "110 g", "220 g"]),
            ("Maggi Nutri-licious Atta Noodles", "Whole grain wheat noodles with real spinach and fiber.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 25.00, ["72 g", "288 g (4 pack)", "576 g (8 pack)"]),
            ("Nissin Top Ramen Curry Noodles", "Flat savory noodles in aromatic curry sauce.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 18.00, ["70 g", "280 g", "560 g"]),
            ("Wai Wai Ready-To-Eat Noodles", "Pre-cooked crunchy spiced noodles to eat dry or in broth.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 15.00, ["70 g", "280 g", "560 g"]),
            ("MTR Ready Gulab Jamun Instant Mix", "Soft dessert balls that soak rich cardamom syrup.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 110.00, ["175 g", "350 g", "700 g"]),
            ("Gits Khaman Dhokla Ready Mix", "Instant fluffy yellow Gujarati snack mix.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 90.00, ["200 g", "500 g", "1 kg"]),
            ("MTR Ready-To-Eat Khatta Meetha Poha", "Flattened rice tempered with peanuts and mustard seeds.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 45.00, ["80 g (Cup)", "160 g", "320 g"]),
            ("Haldiram Aloo Paratha (Frozen)", "Layered whole wheat parathas filled with spiced potatoes.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 140.00, ["4 pcs (400g)", "8 pcs (800g)", "12 pcs"]),
            ("Haldiram Paneer Paratha (Frozen)", "Tender flatbread stuffed with spiced shredded cottage cheese.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 170.00, ["4 pcs (400g)", "8 pcs (800g)", "12 pcs"]),
            ("McCain Veggie Burger Patty", "Crispy spiced vegetable patties for homemade burgers.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 145.00, ["4 pcs (360g)", "8 pcs (720g)", "12 pcs"]),
            ("Real Good Frozen Chicken Sausages", "Juicy spiced smoked chicken breakfast sausages.", "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80", 195.00, ["250 g", "500 g", "1 kg"]),
            ("Frozen Butterfly Prawns", "Cleaned, deveined, and IQF frozen succulent prawns.", "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80", 350.00, ["250 g", "500 g", "1 kg"]),
            ("Frozen Basa Fish Fillets", "Boneless tender white basa fish fillets.", "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80", 280.00, ["500 g", "1 kg", "2 kg"]),
            ("McCain Cheese & Corn Balls", "Crispy crumb coated balls filled with molten cheese and corn.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 155.00, ["200 g", "400 g", "800 g"]),
            ("Sumeru Veg Spring Rolls", "Crunchy wrapper filled with shredded seasoned vegetables.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 135.00, ["6 pcs (200g)", "12 pcs (400g)", "18 pcs"]),
            ("Knorr Hot & Sour Veg Soup", "Zesty, spicy and tangy oriental soup.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 45.00, ["43 g", "86 g", "172 g"]),
            ("Ching's Secret Schezwan Chutney", "Versatile dip and cooking sauce with Sichuan peppers.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 75.00, ["250 g jar", "500 g jar", "1 kg bottle"]),
            ("Maggi Hot & Sweet Tomato Sauce", "Rich tomato ketchup with a spicy red chilli punch.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 95.00, ["500 g bottle", "1 kg bottle", "1.5 kg"]),
            ("Kissan Fresh Tomato Ketchup", "100% real ripe juicy tomato ketchup sauce.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 110.00, ["500 g pouch", "1 kg pouch", "2 kg"]),
            ("Heinz Classic Tomato Ketchup", "Thick and rich world-famous tomato sauce.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 140.00, ["350 g bottle", "700 g bottle", "1 kg"]),
            ("Barilla Penne Rigate Durum Wheat Pasta", "Authentic Italian bronze-cut durum wheat penne pasta.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 175.00, ["500 g", "1 kg", "2 kg"]),
            ("Del Monte Spaghetti Pasta", "Long durum wheat pasta for classic Aglio Olio and Bolognese.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 160.00, ["500 g", "1 kg", "2 kg"]),
            ("Bambino Roasted Vermicelli", "Pre-roasted wheat sevaiyan for kheer and upma.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 45.00, ["200 g", "400 g", "850 g"]),
            ("Weikfield Double Action Baking Powder", "Essential leavening agent for cakes and pastries.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 40.00, ["100 g jar", "200 g jar", "400 g"]),
            ("Weikfield Cocoa Powder", "Rich dark cocoa powder for baking and shakes.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 75.00, ["50 g box", "100 g box", "200 g"]),
            ("Weikfield Vanilla Custard Powder", "Smooth and creamy dessert custard mix.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 45.00, ["100 g", "200 g", "500 g"]),
            ("Pillsbury Choco Fudge Pancake Mix", "Fluffy chocolate pancakes ready in minutes.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 99.00, ["200 g", "400 g", "800 g"]),
            ("MTR Ready-to-Eat Dal Makhani", "Slow-cooked black lentils in creamy butter and tomato gravy.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 115.00, ["300 g pack", "600 g pack", "900 g"]),
            ("MTR Ready-to-Eat Paneer Butter Masala", "Cottage cheese cubes in rich cashew butter gravy.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 130.00, ["300 g pack", "600 g pack", "900 g"]),
            ("MTR Ready-to-Eat Punjabi Rajma", "Red kidney beans cooked in aromatic North Indian spices.", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80", 110.00, ["300 g pack", "600 g pack", "900 g"]),
            ("MTR Ready-to-Eat Veg Biryani", "Fragrant basmati rice cooked with garden fresh vegetables.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 125.00, ["300 g pack", "600 g pack", "900 g"]),
            ("Safal Frozen Mixed Vegetables", "Diced carrots, peas, beans, and corn.", "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&w=600&q=80", 85.00, ["200 g", "500 g", "1 kg"]),
            ("Frozen Soya Chaap Sticks", "Tender soya chaap for grilling, tandoori, and curries.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 110.00, ["500 g", "1 kg", "2 kg"]),
            ("Prasuma Pork/Chicken Momos (Frozen)", "Steamed juicy authentic Tibetan momos.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 190.00, ["10 pcs (240g)", "20 pcs (480g)", "30 pcs"]),
            ("Gits Instant Idli Mix", "Light and spongy traditional South Indian steamed rice idlis.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 90.00, ["200 g", "500 g", "1 kg"]),
            ("Gits Instant Dosa Mix", "Crispy golden South Indian crepes ready in minutes.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 95.00, ["200 g", "500 g", "1 kg"]),
        ],
        "munchies-chips": [
            ("Lay's India's Magic Masala", "Spicy, tangy, and crunchy ridged potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["50 g", "115 g (Party Pack)", "230 g (Jumbo)"]),
            ("Doritos Cheese Supreme Nachos", "Crisp triangular corn tortilla chips loaded with nacho cheese.", "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80", 30.00, ["60 g", "140 g (Big Pack)", "280 g (Max)"]),
            ("Kurkure Masala Munch", "Tedha par mera crunchy spiced corn puffs.", "https://images.unsplash.com/photo-1621447504864-d8686e12698c?auto=format&fit=crop&w=600&q=80", 20.00, ["75 g", "150 g", "300 g"]),
            ("Bingo! Mad Angles Achaari Masti", "Tangy mango pickle flavoured triangular crunchy crisps.", "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80", 20.00, ["66 g", "130 g", "260 g"]),
            ("Haldiram Nagpur Aloo Bhujia", "Crisp spicy potato & moth flour seasoned noodles.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "350 g", "1 kg"]),
            ("Pringles Sour Cream & Onion", "Stackable potato crisps seasoned with cream and spring onion.", "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=600&q=80", 115.00, ["107 g (Can)", "165 g (Can)", "2-Pack Cans"]),
            ("Uncle Chipps Spicy Treat", "Traditional Indian spiced thin ridged potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["50 g", "100 g", "200 g"]),
            ("Bingo! Tedhe Medhe Masala Tadka", "Spindle-shaped crunchy snack with chatpata masala.", "https://images.unsplash.com/photo-1621447504864-d8686e12698c?auto=format&fit=crop&w=600&q=80", 20.00, ["75 g", "150 g", "300 g"]),
            ("Crax Corn Rings (Chatpata Masala)", "Nostalgic crunchy corn rings with finger-licking seasoning.", "https://images.unsplash.com/photo-1621447504864-d8686e12698c?auto=format&fit=crop&w=600&q=80", 15.00, ["40 g", "85 g", "170 g"]),
            ("Haldiram Roasted Salted Peanuts", "Crunchy slow-roasted golden peanuts with sea salt.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 35.00, ["140 g", "200 g", "400 g"]),
            ("Lay's Classic Salted", "Lightly salted crispy wafer thin potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["50 g", "115 g", "230 g"]),
            ("Lay's American Style Cream & Onion", "Smooth herb cream and onion flavored crispy chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["50 g", "115 g", "230 g"]),
            ("Doritos Sweet Chilli Flavour", "Bold crunch tortilla chips with spicy sweet heat.", "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80", 30.00, ["60 g", "140 g", "280 g"]),
            ("Kurkure Solid Masti Masala Twisteez", "Spiral shaped crunchy masala grain snack.", "https://images.unsplash.com/photo-1621447504864-d8686e12698c?auto=format&fit=crop&w=600&q=80", 20.00, ["75 g", "150 g", "300 g"]),
            ("Haldiram Bhujia Sev", "Traditional Rajasthani crispy gram flour noodles.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "350 g", "1 kg"]),
            ("Haldiram Khatta Meetha Mixture", "Sweet and sour mixture of sev, boondi, and nuts.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "350 g", "1 kg"]),
            ("Haldiram Salted Moong Dal", "Crunchy fried green gram lentils with mild salt.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "350 g", "1 kg"]),
            ("Haldiram Navratan Mixture", "Crunchy blend of 9 savory nuts, pulses, and sev.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "350 g", "1 kg"]),
            ("Pringles Original Salted", "Classic stackable crisps with clean salted flavor.", "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=600&q=80", 115.00, ["107 g", "165 g", "2-Pack Cans"]),
            ("Pringles Hot & Spicy", "Zesty and fiery chili seasoned crispy snacks.", "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=600&q=80", 115.00, ["107 g", "165 g", "2-Pack Cans"]),
            ("Pringles Smoky BBQ", "Rich hickory smoke barbecue seasoned potato chips.", "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=600&q=80", 115.00, ["107 g", "165 g", "2-Pack Cans"]),
            ("Bingo No Rulz Masala Curls", "Melt-in-mouth curls tossed in chatpata masala.", "https://images.unsplash.com/photo-1621447504864-d8686e12698c?auto=format&fit=crop&w=600&q=80", 15.00, ["50 g", "100 g", "200 g"]),
            ("Balaji Wafers Cream & Onion", "Crunchy thin sliced spiced potato wafers.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["65 g", "135 g", "270 g"]),
            ("Balaji Wafers Simply Salted", "Pure potato slices salted to perfection.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["65 g", "135 g", "270 g"]),
            ("Parle Hide & Seek Choco Chip Cookies", "Moulded chocolate cookies with rich real chocolate chips.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 35.00, ["120 g", "250 g", "500 g"]),
            ("Britannia Bourbon The Original", "Smooth chocolate cream sandwiched between crunchy sugar-sprinkled biscuits.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 30.00, ["120 g", "240 g", "480 g"]),
            ("Oreo Vanilla Creme Sandwich", "Iconic dark cocoa biscuits with sweet vanilla cream.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 35.00, ["120 g", "250 g", "500 g"]),
            ("Britannia Good Day Cashew Cookies", "Buttery cookies loaded with rich crunchy cashews.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 30.00, ["100 g", "200 g", "400 g"]),
            ("Britannia 50-50 Maska Chaska", "Sweet and salty butter tossed herb crackers.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 25.00, ["100 g", "200 g", "400 g"]),
            ("Dark Fantasy Choco Fills", "Crisp crust filled with rich molten chocolate cream.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 40.00, ["75 g", "150 g", "300 g"]),
            ("Parle Monaco Salted Crackers", "Crispy light salted crackers for dips and toppings.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 20.00, ["120 g", "240 g", "480 g"]),
            ("Parle Krackjack Sweet & Salty", "The original sweet and salty tea-time biscuits.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 25.00, ["120 g", "240 g", "480 g"]),
            ("Britannia Little Hearts", "Sweet sugar-glazed heart shaped airy biscuits.", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80", 20.00, ["75 g", "150 g", "300 g"]),
            ("Cadbury Dairy Milk Silk Chocolate", "Ultra-smooth melt-in-mouth milk chocolate bar.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 85.00, ["60 g", "150 g", "250 g"]),
            ("Nestle KitKat 4-Finger Wafer Bar", "Crisp baked wafer fingers coated in smooth milk chocolate.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 30.00, ["38 g (1 pc)", "114 g (3 pack)", "228 g (6 pack)"]),
            ("Snickers Peanut Caramel Chocolate Bar", "Milk chocolate packed with roasted peanuts, caramel, and nougat.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 45.00, ["45 g", "90 g (Duo)", "180 g (4-pack)"]),
            ("Cadbury Perk Chocolate Wafer", "Light crunchy chocolate wafer coated in milk chocolate.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 10.00, ["15 g", "45 g", "90 g"]),
            ("Cadbury 5 Star Chocolate", "Chewy caramel and chocolate nugget bar.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 20.00, ["40 g", "80 g", "160 g"]),
            ("Nestle Milkybar White Chocolate", "Creamy and milky sweet white chocolate bar.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 20.00, ["25 g", "50 g", "100 g"]),
            ("Ferrero Rocher Hazelnut Chocolates", "Crisp whole hazelnut wrapped in rich creamy chocolate filling.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 199.00, ["4 pcs box", "8 pcs box", "16 pcs box"]),
            ("Nutella Hazelnut Cocoa Spread", "Rich hazelnut spread with creamy cocoa.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80", 220.00, ["180 g jar", "350 g jar", "750 g jar"]),
            ("Haldiram Soan Papdi", "Flaky and melt-in-mouth traditional gram flour confection.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 85.00, ["200 g", "500 g", "1 kg"]),
            ("Bikaji Bikaneri Bhujia", "Crisp spiced moth bean noodles from Bikaner.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 50.00, ["200 g", "400 g", "1 kg"]),
            ("Bikano Bikaneri Bhujia", "Spiced and crunchy gram flour savory mixture.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 50.00, ["200 g", "400 g", "1 kg"]),
            ("Tong Garden Salted Almonds", "Slow roasted premium American almonds.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 160.00, ["140 g", "280 g", "500 g"]),
            ("Tong Garden Salted Cashews", "Rich and crunchy whole roasted salted cashews.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 175.00, ["140 g", "280 g", "500 g"]),
            ("Cornitos Nacho Crisps (Cheese & Herbs)", "Crispy corn nachos baked and seasoned with cheese.", "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=80", 45.00, ["60 g", "150 g", "300 g"]),
            ("4700BC Gourmet Cheese Popcorn", "Jumbo popped corn coated in rich cheddar cheese.", "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=600&q=80", 85.00, ["80 g tin", "160 g tin", "320 g"]),
            ("Lotte Choco Pie (Pack of 6)", "Soft chocolate coated marshmallow sponge cake.", "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80", 90.00, ["6 pcs (168g)", "12 pcs (336g)", "18 pcs"]),
            ("Farmley Roasted Peri Peri Makhana", "Crispy Foxnuts roasted with tangy Peri Peri spices.", "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=600&q=80", 120.00, ["100 g", "200 g", "400 g"]),
        ],
        "personal-care": [
            ("Dettol Original Liquid Handwash", "Protects against 100 illness causing germs.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 99.00, ["200 ml (Pump)", "675 ml (Refill)", "1.5 L (Refill)"]),
            ("Colgate MaxFresh Red Gel Toothpaste", "Intense cooling crystals for fresh breath and clean teeth.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 110.00, ["80 g", "150 g", "300 g (2x150g)"]),
            ("Dove Deep Moisture Beauty Bar", "Contains 1/4 moisturising cream for soft, smooth skin.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 65.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Head & Shoulders Cool Menthol Shampoo", "Fights dandruff and cools the scalp with menthol.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 185.00, ["180 ml", "340 ml", "650 ml (Pump)"]),
            ("Nivea Soft Light Moisturiser", "Fast absorbing light cream with Jojoba oil and Vitamin E.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 95.00, ["50 ml jar", "100 ml jar", "300 ml tub"]),
            ("Pears Pure & Gentle Glycerin Soap", "Transparent glycerine soap with natural oils for gentle cleansing.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 55.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Sensodyne Rapid Relief Toothpaste", "Clinically proven to beat tooth sensitivity in 60 seconds.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 175.00, ["80 g", "150 g", "240 g (3 pack)"]),
            ("Fiama Blackcurrant & Bearberry Shower Gel", "Skin conditioning shower gel with luscious moisture beads.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 145.00, ["250 ml", "500 ml", "1 L"]),
            ("Gillette Classic Sensitive Shaving Foam", "Thick and creamy protective lather for a smooth glide.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 130.00, ["196 g (200ml)", "392 g (400ml)", "2-pack"]),
            ("Himalaya Purifying Neem Face Wash", "Prevents pimples and purifies skin with organic neem and turmeric.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 85.00, ["50 ml", "100 ml", "200 ml (Pump)"]),
            ("Clinic Plus Strong & Long Shampoo", "Enriched with milk protein and multivitamins for healthy hair.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 120.00, ["175 ml", "340 ml", "650 ml (Pump)"]),
            ("Pond's Magic Freshness Talc (Acacia)", "Soft cooling talcum powder with acacia and honey fragrance.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 75.00, ["100 g", "300 g", "400 g"]),
            ("CloseUp Everfresh Red Hot Gel Toothpaste", "Anti-bacterial zinc mouthwash infused red gel toothpaste.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 95.00, ["80 g", "150 g", "300 g (2 pack)"]),
            ("Dettol Original Bathing Soap", "Antibacterial bath soap with pine and disinfectant protection.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 45.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Savlon Moisture Shield Liquid Handwash", "Mild and effective protection against germs with natural glycerine.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 85.00, ["175 ml", "725 ml (Refill)", "1.5 L (Refill)"]),
            ("Pantene Pro-V Hair Fall Control Shampoo", "Strengthens hair roots against styling damage and breakage.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 195.00, ["180 ml", "340 ml", "650 ml (Pump)"]),
            ("Vaseline Intensive Care Deep Moisture Lotion", "Nourishing body lotion with pure oat extract and micro-droplets.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 170.00, ["100 ml", "200 ml", "400 ml (Pump)"]),
            ("Colgate Total Advanced Health Toothpaste", "12-hour whole mouth antibacterial protection.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 130.00, ["120 g", "240 g", "480 g"]),
            ("Oral-B Pro-Health Toothbrush (Medium)", "Cross-action criss-cross bristles for superior plaque removal.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 45.00, ["1 pc", "2 pcs pack", "4 pcs pack"]),
            ("Whisper Choice Ultra Sanitary Pads (XL)", "All-night leakage protection with wings.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 75.00, ["6 pads", "20 pads", "40 pads"]),
            ("Stayfree Secure Cottony Extra Large", "Cottony soft cover with deep absorption channels.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 80.00, ["7 pads", "20 pads", "40 pads"]),
            ("Dettol Antiseptic Liquid", "Classic first-aid and medical disinfectant solution.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 125.00, ["250 ml", "550 ml", "1 L"]),
            ("Parachute 100% Pure Coconut Hair Oil", "Naturally filtered coconut hair oil for strong nourished hair.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 95.00, ["175 ml", "300 ml", "600 ml"]),
            ("Bajaj Almond Drops Non-Sticky Hair Oil", "Light hair oil with 6x Vitamin E for silky shine.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 115.00, ["100 ml", "200 ml", "500 ml"]),
            ("Dabur Amla Nourishing Hair Oil", "Enriched with amla extract for long dark hair.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 85.00, ["100 ml", "275 ml", "500 ml"]),
            ("Nivea Men Cool Kick Roll-On Deodorant", "48-hour antiperspirant with cool ocean extracts.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 135.00, ["25 ml", "50 ml", "100 ml"]),
            ("Fogg Marco Fragrance Body Spray", "Long-lasting no-gas intense masculine perfume body spray.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 199.00, ["120 ml", "150 ml", "250 ml"]),
            ("Wild Stone Edge Deodorant Spray", "Magnetic and energetic fragrance for men.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 160.00, ["150 ml", "225 ml", "300 ml"]),
            ("Engage W1 Women Perfume Spray", "Fruity and floral feminine fragrance.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 175.00, ["120 ml", "150 ml", "250 ml"]),
            ("Axe Dark Temptation Deodorant", "Sweet and sensual chocolate fragrance.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 180.00, ["150 ml", "215 ml", "300 ml"]),
            ("Lifebuoy Total 10 Germ Protection Soap", "Formulated with active silver formula for total germ protection.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 35.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Santoor Sandal & Turmeric Soap", "Gives glowing and youthful skin with natural sandalwood.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 40.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Lux Velvet Glow Jasmine Soap", "Infused with floral beauty oil and sweet French rose.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 42.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Cinthol Original Germ Protection Soap", "Classic deodorant bath soap with fresh confidence.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 45.00, ["75 g (1 bar)", "225 g (3 pack)", "375 g (5 pack)"]),
            ("Tresemme Keratin Smooth Shampoo", "Salon-quality argan oil infused anti-frizz shampoo.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 220.00, ["185 ml", "340 ml", "650 ml (Pump)"]),
            ("L'Oreal Paris Total Repair 5 Shampoo", "Repairs 5 signs of damaged hair with ceramide cement.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 210.00, ["175 ml", "340 ml", "650 ml (Pump)"]),
            ("Sunsilk Black Shine Shampoo", "Infused with amla pearl complex for lustrous dark hair.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 115.00, ["180 ml", "340 ml", "650 ml (Pump)"]),
            ("Garnier Men Acno Fight Face Wash", "Anti-imperfection cooling menthol face wash for men.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 99.00, ["50 g", "100 g", "150 g"]),
            ("Clean & Clear Foaming Face Wash", "Oil-free face wash that leaves skin glowing and clean.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 85.00, ["50 ml", "100 ml", "150 ml"]),
            ("Glow & Lovely Advanced Multivitamin Cream", "Daily brightening face cream with vitamins B3 and C.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 75.00, ["25 g", "50 g", "100 g"]),
            ("Nivea Men Dark Spot Reduction Cream", "Non-sticky daily facial moisturiser with UV filters.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 130.00, ["30 ml", "75 ml", "150 ml"]),
            ("Boroline Antiseptic Ayurvedic Cream", "Relieves dry chapped skin and cuts with zinc oxide and lanolin.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 42.00, ["20 g tube", "40 g tube", "80 g tub"]),
            ("BoroPlus Antiseptic Skin Cream", "Ayurvedic herbs cream for soft healing and moisturising.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 40.00, ["20 g", "40 g", "80 g"]),
            ("Vaseline Original Pure Petroleum Jelly", "100% pure triple-purified protective skin sealant.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 45.00, ["42 g jar", "85 g jar", "170 g jar"]),
            ("Joy Skin Fruits Lemon Brightening Face Wash", "Vitamin C enriched gentle cleansing face wash.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 65.00, ["50 ml", "100 ml", "150 ml"]),
            ("Yardley London English Lavender Talc", "Fine talcum powder infused with pure lavender essential oils.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 120.00, ["100 g", "250 g", "400 g"]),
            ("Old Spice After Shave Lotion (Original)", "Classic masculine bracing fragrance after-shave splash.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 175.00, ["50 ml", "100 ml", "150 ml"]),
            ("Gillette Mach3 Manual Shaving Razor", "3-blade pivoting razor with lubricating strip.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 250.00, ["1 razor", "1 razor + 2 blades", "1 razor + 4 blades"]),
            ("Gillette Mach3 Replacement Blades", "DuraComfort blades for an effortless glide.", "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", 350.00, ["2 cartridges", "4 cartridges", "8 cartridges"]),
            ("Listerine Cool Mint Antiseptic Mouthwash", "Kills 99.9% of bad breath germs for 24h plaque protection.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 135.00, ["250 ml", "500 ml", "1 L"]),
        ],
        "household-essentials": [
            ("Vim Dishwash Liquid Gel (Lemon)", "1 spoon dissolves tough grease on hundreds of utensils.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 55.00, ["250 ml", "500 ml", "1.8 L"]),
            ("Surf Excel Easy Wash Detergent Powder", "Removes tough stains like tea, oil, and mud easily.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 140.00, ["500 g", "1 kg", "3 kg"]),
            ("Lizol Disinfectant Surface Cleaner (Citrus)", "Kills 99.9% germs and gives a sparkling floor shine.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 98.00, ["500 ml", "1 L", "2 L"]),
            ("Harpic Power Plus Toilet Cleaner (Original)", "10x better cleaning than bleach against limescale and stains.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 92.00, ["500 ml", "1 L", "2 L (Twin Pack)"]),
            ("Comfort After Wash Fabric Conditioner (Lily)", "Provides unmatched softness and 14 days long-lasting fragrance.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 125.00, ["220 ml", "860 ml", "2 L"]),
            ("Ariel Matic Front Load Detergent Powder", "Deep cleaning technology specifically designed for front loaders.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 220.00, ["1 kg", "2 kg", "4 kg"]),
            ("Dettol Multipurpose Disinfectant Liquid", "Hygiene liquid for floor cleaning, laundry, and surface disinfection.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 175.00, ["500 ml", "1 L", "2 L"]),
            ("Pril Kraft Dishwash Liquid (Lime)", "Active power droplets cut through burnt food residue.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 65.00, ["225 ml", "425 ml", "2 L"]),
            ("Colin Glass Cleaner Spray", "Streak-free shine on glass, mirrors, and appliances.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 85.00, ["250 ml", "500 ml (Spray)", "1 L (Refill)"]),
            ("Godrej Aer Pocket Bathroom Fragrance", "Power gel technology keeps bathroom smelling fresh for 30 days.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 55.00, ["1 pc (10g)", "3 pcs pack", "5 pcs pack"]),
            ("Rin Advanced Detergent Bar", "Gives dazzling whites on shirts, collars, and cuffs.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 25.00, ["140 g (1 bar)", "420 g (3 pack)", "700 g (5 pack)"]),
            ("Hit Flying Insect Killer Spray (Lime)", "Instant kill formula against dangerous mosquitoes and flies.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 145.00, ["200 ml", "400 ml", "625 ml"]),
            ("Odonil Room Air Freshener Blocks", "Continuous soothing fragrance for bedrooms and living spaces.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 60.00, ["50 g (1 block)", "150 g (3 pack)", "250 g (5 pack)"]),
            ("Surf Excel Matic Liquid Detergent", "Dissolves instantly in washing machine with zero residue.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 210.00, ["500 ml", "1 L", "2 L"]),
            ("Baygon Multi Insect Killer Spray", "Dual action formula against crawling cockroaches and mosquitoes.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 130.00, ["200 ml", "400 ml", "625 ml"]),
            ("Harpic Bathroom Cleaner Liquid (Lemon)", "Removes tough soap scum and yellowish stains on bathroom tiles.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 95.00, ["500 ml", "1 L", "2 L"]),
            ("Lizol Disinfectant Floor Cleaner (Floral)", "Pleasant floral aroma with superior germicidal floor cleaning.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 98.00, ["500 ml", "1 L", "2 L"]),
            ("Comfort Fabric Conditioner (Morning Fresh)", "Conditioning fragrance capsules that burst with movement.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 125.00, ["220 ml", "860 ml", "2 L"]),
            ("Ariel 3-in-1 Detergent Pods", "Pre-measured laundry capsules that clean, brighten, and remove stains.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 250.00, ["12 pods box", "24 pods box", "36 pods box"]),
            ("Tide Plus Extra Power Detergent", "Bright white clothes with jasmine & rose fragrance.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 115.00, ["1 kg", "3 kg", "5 kg"]),
            ("Wheel 2-in-1 Clean & Fresh Powder", "Active lemon and thousand flower extracts for fresh clothes.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 65.00, ["1 kg", "3 kg", "5 kg"]),
            ("Henko Matic Top Load Liquid Detergent", "Enzymatic lint reduction formula for washing machines.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 185.00, ["1 L", "2 L", "4 L"]),
            ("Scotch-Brite Scrub Sponge (Pad + Sponge)", "Dual side cellulose sponge for gentle scratch-free dishwashing.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 35.00, ["1 pc", "3 pcs pack", "6 pcs pack"]),
            ("Scotch-Brite Heavy Duty Scrub Pad", "Dense green scouring pad for tough burnt vessels.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 20.00, ["2 pcs", "6 pcs pack", "12 pcs pack"]),
            ("Gala Dustpan and Soft Broom Set", "Ergonomic wide dustpan with fine-edge rubber lip.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 150.00, ["1 set", "2 sets", "3 sets"]),
            ("Gala Super Floor Wiper", "Streak-free EVA rubber blade floor wiper for dry floors.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 199.00, ["1 pc (Standard)", "1 pc (Wide)", "2 pcs"]),
            ("Scotch-Brite Kitchen Squeegee Wiper", "Quick drying counter wiper for kitchen platforms and slabs.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 85.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Vim Anti-Smell Pudina Gel", "Pudina active anti-smell dishwash gel.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 60.00, ["250 ml", "500 ml", "750 ml"]),
            ("Exxo Dishwash Tub with Free Scrubber", "Hard water dishwashing paste with lime and active carbon.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 35.00, ["250 g tub", "500 g tub", "1 kg tub"]),
            ("Pitambari Shining Powder (Copper & Brass)", "Special cleaning powder that restores bright shine to metals.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 38.00, ["100 g", "200 g", "500 g"]),
            ("Dettol Surface Disinfectant Spray", "Alcohol disinfectant spray for door handles, parcels, and keys.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 160.00, ["170 g (225ml)", "340 g", "500 ml"]),
            ("Godrej Hit Anti-Cockroach Gel", "Attracts and kills cockroaches in hard to reach kitchen corners.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 95.00, ["20 g tube", "40 g", "80 g"]),
            ("Good Knight Gold Flash Liquid Vaporizer", "Dual mode mosquito repellent with automatic flash mode.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 85.00, ["1 machine + 1 refill", "2 refills pack", "4 refills pack"]),
            ("All Out Ultra Mosquito Liquid Refill", "Heated liquid wick provides 45 nights of mosquito defense.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 75.00, ["45 ml (1 refill)", "90 ml (2 refills)", "180 ml (4 refills)"]),
            ("Mortein 2-in-1 Mosquito & Fly Killer", "Fast knockdown spray formula against household pests.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 135.00, ["200 ml", "425 ml", "650 ml"]),
            ("Taski R2 Hygienic Hard Surface Cleaner", "Professional grade concentrated floor and tile cleaning agent.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 240.00, ["1 L", "2 L", "5 L (Can)"]),
            ("Vanish All in One Stain Remover Powder", "Oxygen power removes chlorine-free stains on colored clothes.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 120.00, ["200 g jar", "400 g jar", "800 g jar"]),
            ("Ala Fabric Bleach Liquid", "Whitens and removes tough grey build up on white uniforms.", "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80", 45.00, ["500 ml", "1 L", "2 L"]),
            ("Harpic Flushmatic Toilet Cistern Block", "Cleans with every single flush and turns water blue.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 75.00, ["1 pc (50g)", "2 pcs pack", "4 pcs pack"]),
            ("Ambi Pur Car Air Freshener Gel", "Continuous soothing lavender fragrance for car interiors.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 140.00, ["75 g", "150 g", "225 g"]),
            ("Air Wick Automatic Spray Refill", "24/7 automatic room fragrance with essential oils.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 250.00, ["250 ml (1 can)", "500 ml (2 cans)", "750 ml"]),
            ("Godrej Aer Room Freshener Spray (Petal Crush)", "Premium water-based room fragrance spray.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 130.00, ["220 ml", "440 ml", "660 ml"]),
            ("Odopic Dishwash Washing Powder", "Abrasive dishwash cleaning powder with lime grease cutters.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 30.00, ["500 g", "1 kg", "2 kg"]),
            ("Colin Glass Cleaner Refill Pouch", "Economical refill pouch for glass spray bottles.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 75.00, ["500 ml", "1 L", "2 L"]),
            ("Scotch-Brite Round Toilet Cleaning Brush", "Curved thick bristles with long handle for under-rim cleaning.", "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80", 120.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Gala Spin Mop with Wringer Bucket Set", "360-degree rotating microfiber mop for easy floor cleaning.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 799.00, ["1 set (Standard)", "1 set + 2 Refills", "1 set + 4 Refills"]),
            ("Shalimar Biodegradable Garbage Bags", "Durable leak-proof roll of black garbage bin liners.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 85.00, ["Medium (30 bags)", "Large (60 bags)", "XL (90 bags)"]),
            ("Freshwrapp Food Aluminium Foil", "Food-grade baking and packing heat retention aluminium roll.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 99.00, ["9 meters", "18 meters", "27 meters"]),
            ("Freshwrapp Cling Film Food Wrap", "Transparent stretchable moisture-locking food wrap.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 110.00, ["30 meters", "60 meters", "100 meters"]),
            ("Microfiber Multipurpose Cleaning Cloths", "Lint-free ultra absorbent kitchen and vehicle dusters.", "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80", 120.00, ["3 pcs pack", "6 pcs pack", "12 pcs pack"]),
        ],
        "raksha-bandhan": [
            # Rakhis & Accessories
            ("Designer Lumba Rakhi Set", "Beautiful lumba rakhi set with decorative thread and golden beads for bhai-behen. Comes in a premium gift box.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 129.00, ["1 Set", "2 Set Combo", "5 Set Bundle"]),
            ("Silver Zardosi Designer Rakhi", "Hand-crafted premium zardosi rakhi with silver thread and stone embellishments. Perfect for gifting.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 199.00, ["1 pc", "2 pc set", "5 pc set"]),
            ("Kids Cartoon Rakhi Set", "Fun and colorful kids rakhi with popular cartoon characters: Doraemon, Spiderman, Minions. Kids favourite!", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 89.00, ["2 pcs", "5 pcs", "10 pcs"]),
            ("Rudraksha Rakhi", "Spiritual Rudraksha bead rakhi with sandalwood fragrance. Auspicious gifting for brothers.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 149.00, ["1 pc", "3 pcs", "5 pcs"]),
            ("Fancy Stone & Pearl Rakhi", "Elegant pearl and coloured stone rakhi with adjustable thread. Beautiful and long-lasting.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 119.00, ["1 pc", "2 pc", "5 pc"]),
            ("Roli Chawal Tilak Set", "Traditional Raksha Bandhan puja thali set with Roli, Chawal, Kumkum, Mishri and Deepak.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 79.00, ["Basic Set", "Premium Set", "Deluxe Thali"]),
            # Chocolates & Mithai Gift Sets
            ("Cadbury Celebrations Gift Pack", "Premium assorted Cadbury chocolates in a festive gift box. Includes 5 Silk bars, Bournville, and Gems.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 299.00, ["Small 198g", "Medium 349g", "Large 586g"]),
            ("Ferrero Rocher Gift Box", "Imported premium hazelnut chocolate truffles in a gold foil gift box. Classy gifting option.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 349.00, ["8 pcs box", "16 pcs box", "24 pcs box"]),
            ("Haldirams Kaju Katli Box", "Freshly made pure ghee kaju katli from Haldirams. Silver vark topped cashew fudge.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 249.00, ["250 g box", "500 g box", "1 kg box"]),
            ("Assorted Ladoo Gift Box", "Mix of Besan, Boondi, and Motichoor Ladoos packed in a beautiful festive box.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 199.00, ["250 g", "500 g", "1 kg"]),
            ("Belgian Dark Chocolate Bar", "Rich 70% dark Belgian chocolate with almonds. Premium imported festive gifting chocolate.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 189.00, ["80g bar", "150g bar", "300g box"]),
            ("KitKat Rakhi Special Bundle", "KitKat festive bundle with mini bars and wrapped rakhi thread. Fun & yummy gifting combo.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 129.00, ["Small Pack", "Medium Pack", "Jumbo Pack"]),
            ("Patanjali Ghee Mysore Pak", "Traditional South Indian Mysore pak made with Desi Ghee. Melt in mouth festive delicacy.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 219.00, ["250 g", "500 g", "1 kg"]),
            ("Milk Chocolate Assorted Box", "Delicious mix of milk chocolates - Dairy Milk, 5 Star, Eclairs and Caramels.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 179.00, ["200 g box", "350 g box", "500 g box"]),
            # Gift Hampers
            ("Rakhi Premium Gift Hamper", "Complete Rakhi gift hamper with Designer Rakhi, Kaju Katli, Cadbury Celebrations, and Dry Fruits.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 599.00, ["Basic Hamper", "Premium Hamper", "Luxury Hamper"]),
            ("Dry Fruits Rakhi Gift Box", "Premium dry fruits combo - Badam, Kaju, Pista, Akhrot in a festive jute box.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 449.00, ["250 g", "500 g", "1 kg"]),
            ("Chocolate & Rakhi Combo", "Curated combo with 1 Designer Rakhi + Silk Chocolate + Roli Chawal. Perfect all-in-one Rakhi gift.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 249.00, ["Small Set", "Classic Set", "Grand Set"]),
            ("Silver Plated Rakhi Thali", "Beautiful silver-plated puja thali with Deepak, Roli, Chawal, and Aarti Diya for Raksha Bandhan.", "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80", 349.00, ["Small Thali", "Medium Thali", "Grand Thali"]),
            # Sweets
            ("Fresh Gulab Jamun Box", "Soft, syrup-soaked fresh Gulab Jamuns. Made with Milk Mawa. Best served warm.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 99.00, ["10 pcs", "20 pcs", "30 pcs"]),
            ("Premium Soan Papdi Box", "Crispy flaky Soan Papdi wrapped in festive gifting box. Classic Rakhi mithai.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 149.00, ["200 g", "500 g", "1 kg"]),
            ("Badam Barfi Box", "Rich and creamy almond barfi with pure saffron and silver vark topping.", "https://images.unsplash.com/photo-1548848221-0c2e497ed557?auto=format&fit=crop&w=600&q=80", 269.00, ["250 g", "500 g", "1 kg"]),
        ],
        "cooking-essentials": [
            ("Fortune Sunflower Oil", "Light and healthy refined sunflower cooking oil, ideal for everyday cooking and frying.", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80", 135.00, ["500 ml", "1 L", "2 L"]),
            ("Saffola Gold Oil", "Blended edible oil with LOSORB technology for healthy heart cooking.", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80", 149.00, ["500 ml", "1 L", "2 L"]),
            ("Patanjali Cow Ghee", "Pure desi ghee from A2 cow milk, made using traditional Bilona method. Rich in vitamins.", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80", 399.00, ["200 ml jar", "500 ml jar", "1 L tin"]),
            ("Everest Garam Masala", "Aromatic whole spice blend for authentic Indian curries and biryanis.", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", 55.00, ["50 g", "100 g", "200 g"]),
            ("MDH Chhole Masala", "Restaurant-style spice blend for perfect chhole and chole curry.", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", 45.00, ["50 g", "100 g", "200 g"]),
            ("Catch Turmeric Powder", "Pure, bright yellow haldi powder with natural curcumin for curries.", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", 35.00, ["100 g", "200 g", "500 g"]),
            ("Tata Salt Iodised", "Vacuum evaporated pure iodised salt with free-flowing crystals. Classic kitchen staple.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 22.00, ["500 g", "1 kg", "2 kg"]),
            ("Sugar (M30 Grade)", "Pure refined white sugar, ideal for tea, sweets, and baking.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 45.00, ["500 g", "1 kg", "2 kg"]),
            ("Aashirvaad Atta (Whole Wheat)", "100% whole wheat atta with goodness of bran and protein. Soft roti guarantee.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 75.00, ["1 kg", "5 kg", "10 kg"]),
            ("Dabur Honey", "100% pure natural honey with no added sugar or colour. Rich in antioxidants.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 99.00, ["250 g", "500 g", "1 kg"]),
            ("Heinz Tomato Ketchup", "Classic tangy tomato ketchup with no artificial colours or preservatives.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 89.00, ["200 g", "450 g", "900 g"]),
            ("Kissan Mixed Fruit Jam", "Delicious fruity jam made from real fruit pulp. Great for bread, toast and sandwiches.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 69.00, ["200 g", "500 g", "1 kg"]),
            ("Baking Powder (Modern)", "Leavening agent for light and fluffy baking. Used in cakes, muffins and pancakes.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 35.00, ["50 g", "100 g", "200 g"]),
            ("Sona Masoori Raw Rice", "Premium quality long-grain Sona Masoori raw rice from Andhra Pradesh.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 65.00, ["1 kg", "5 kg", "10 kg"]),
            ("Basmati Aged Rice (India Gate)", "Classic aged basmati rice with long grains and aromatic flavour for biryani.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 120.00, ["1 kg", "5 kg", "10 kg"]),
        ],
        "dry-fruits-nuts": [
            ("Premium California Almonds", "Raw whole California Badam rich in Vitamin E and healthy fats. Best quality.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 180.00, ["100 g", "250 g", "500 g"]),
            ("Roasted Cashews (Kaju)", "Lightly roasted premium W320 grade whole cashew kernels. Crunchy and delicious.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 220.00, ["100 g", "250 g", "500 g"]),
            ("Afghan Green Raisins (Kishmish)", "Seedless sun-dried green raisins from Afghanistan. Natural sweetness with no preservatives.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 90.00, ["100 g", "250 g", "500 g"]),
            ("Pista (Pistachio Kernels)", "Roasted salted pistachio kernels, rich in protein and antioxidants.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 250.00, ["100 g", "250 g", "500 g"]),
            ("Akhrot (Walnut Kernels)", "Premium quality shelled walnut halves — brain food rich in Omega-3 fatty acids.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 210.00, ["100 g", "250 g", "500 g"]),
            ("Jumbo Medjool Dates", "Premium Saudi/Medjool dates — naturally sweet, soft and rich in iron and fiber.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 180.00, ["250 g", "500 g", "1 kg"]),
            ("Dried Turkish Apricots", "Soft and naturally sweet sun-dried apricots rich in Vitamin A and potassium.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 120.00, ["100 g", "250 g", "500 g"]),
            ("Mixed Dry Fruits Pack", "A curated mix of Badam, Kaju, Pista, Kishmish and Anjeer. Perfect daily health snack.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 295.00, ["200 g", "500 g", "1 kg"]),
            ("Roasted Peanuts (Groundnuts)", "Crunchy lightly salted roasted peanuts. High protein, energy-dense snack.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 45.00, ["150 g", "300 g", "500 g"]),
            ("Sunflower Seeds", "Nutritious and crunchy roasted sunflower seeds — a powerhouse of Vitamin E and selenium.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 55.00, ["100 g", "250 g", "500 g"]),
            ("Pumpkin Seeds (Pepitas)", "Organic pumpkin seeds rich in magnesium, zinc and antioxidants. Great for salads and snacking.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 75.00, ["100 g", "250 g", "500 g"]),
            ("Chia Seeds (Organic)", "Tiny but mighty organic chia seeds packed with omega-3, fibre and protein.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 89.00, ["100 g", "250 g", "500 g"]),
            ("Fox Nuts (Makhana)", "Lightly roasted lotus seeds with low calories and high protein. Phool makhana for healthy snacking.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 110.00, ["100 g", "250 g", "500 g"]),
            ("Pine Nuts (Chilgoza)", "Premium Himalayan pine nuts — delicious in salads, pesto and desserts.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 350.00, ["50 g", "100 g", "200 g"]),
            ("Saffron (Kesar) Premium", "Pure Kashmir Kesar premium saffron threads with deep red stigma. Used in biryani, mithai.", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", 499.00, ["0.5 g vial", "1 g vial", "2 g vial"]),
        ],
        "pulses-grains": [
            ("Toor Dal (Arhar)", "Split pigeon peas — the go-to dal for everyday Indian cooking. Rich in protein and fibre.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 95.00, ["500 g", "1 kg", "2 kg"]),
            ("Chana Dal (Split Chickpeas)", "Split Bengal gram — crunchy, protein-rich lentil for dal, chilla and snacks.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 75.00, ["500 g", "1 kg", "2 kg"]),
            ("Masoor Dal (Red Lentil)", "Quick-cooking orange split lentils — light, nutritious and easy to digest.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 85.00, ["500 g", "1 kg", "2 kg"]),
            ("Moong Dal (Yellow Split)", "Skinned split green gram — ideal for khichdi, dal, and moong chilla.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 90.00, ["500 g", "1 kg", "2 kg"]),
            ("Urad Dal (White)", "Skinned black gram — essential for idli, dosa, and medu vada batter.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 100.00, ["500 g", "1 kg", "2 kg"]),
            ("Kabuli Chana (White Chickpeas)", "Large whole chickpeas — perfect for chole, hummus, salads and curries.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 80.00, ["500 g", "1 kg", "2 kg"]),
            ("Green Moong (Whole)", "Whole green moong beans — high protein, easy to sprout. Perfect for healthy snacks.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 75.00, ["500 g", "1 kg", "2 kg"]),
            ("Rajma (Kidney Beans)", "Dark red kidney beans for the iconic North Indian Rajma Chawal dish.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 90.00, ["500 g", "1 kg", "2 kg"]),
            ("Black Eyed Peas (Lobia)", "Creamy white beans with black eye — used in dal tadka, salads and Punjabi curries.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 70.00, ["500 g", "1 kg", "2 kg"]),
            ("Poha (Flattened Rice)", "Thin flattened rice flakes for poha, chivda, and batata poha. Maharashtrian favourite.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 40.00, ["500 g", "1 kg", "2 kg"]),
            ("Quinoa (Organic White)", "Premium organic white quinoa — complete protein grain. Gluten-free superfood.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 189.00, ["250 g", "500 g", "1 kg"]),
            ("Semolina (Rava/Suji)", "Fine wheat semolina for upma, sheera, rava idli and rava dosa.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 35.00, ["500 g", "1 kg", "2 kg"]),
            ("Barley (Jau)", "Whole hulled barley — nutritious grain for soups, khichdi and health drinks.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 55.00, ["500 g", "1 kg", "2 kg"]),
            ("Pearl Millet (Bajra)", "Whole bajra grains for traditional rotis, khichdi, and rustic Indian meals.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 40.00, ["500 g", "1 kg", "2 kg"]),
            ("Oats (Quaker Rolled)", "Heart-healthy rolled oats for porridge, smoothies and overnight oats.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", 79.00, ["400 g", "800 g", "1.5 kg"]),
        ],
        "breakfast-cereals": [
            ("Kelloggs Corn Flakes", "Classic crispy corn flakes packed with iron and vitamins. Enjoy with milk for a quick breakfast.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 129.00, ["250 g", "475 g", "875 g"]),
            ("Kelloggs Chocos", "Chocolatey whole wheat cereal balls kids love. Crunchy in milk with chocolate flavour.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 110.00, ["375 g", "700 g", "1.2 kg"]),
            ("Quaker Oats Porridge", "Gluten-sensitive instant oats with creamy texture. Ready in 2 minutes. Rich in beta-glucan.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 89.00, ["400 g", "800 g", "1.5 kg"]),
            ("Muesli (Saffola FITTIFY)", "High-fibre muesli with almonds, raisins, oats and wheat. No added sugar variant.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 159.00, ["400 g", "700 g", "1 kg"]),
            ("Granola (Yoga Bar)", "Crunchy oat granola with honey, almonds and cranberries. Great with yogurt or milk.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 195.00, ["300 g", "600 g", "1 kg"]),
            ("Upma Mix (MTR)", "Instant upma mix with roasted semolina, spices and dal. Ready in 5 minutes.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 59.00, ["180 g", "500 g", "1 kg"]),
            ("Idli Rava Mix (Gits)", "Instant idli rava with pre-mixed spices. Soft fluffy idlis without overnight soaking.", "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", 75.00, ["200 g", "500 g", "1 kg"]),
            ("Protein Muesli (True Elements)", "High-protein seed and grain muesli with no refined sugar. 8g protein per serving.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 249.00, ["300 g", "500 g", "1 kg"]),
            ("Marie Gold Biscuits (Britannia)", "Crispy light wholegrain digestive biscuits. Perfect for breakfast with tea.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 35.00, ["150 g", "300 g", "600 g"]),
            ("Digestive Biscuits (McVities)", "Classic wholemeal digestive biscuits with bran. Low sugar, high fibre snacking.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 89.00, ["250 g", "500 g", "1 kg"]),
            ("Peanut Butter (Sundrop)", "Creamy no-added-sugar peanut butter. High protein breakfast spread for bread, smoothies.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 149.00, ["200 g", "462 g", "924 g"]),
            ("Nutella Hazelnut Spread", "Rich and creamy hazelnut cocoa spread. The world's favourite breakfast spread.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 199.00, ["200 g", "350 g", "750 g"]),
            ("Protein Bar (RiteBite Max Protein)", "High-protein breakfast bar with 20g protein per serving. No junk, pure nutrition.", "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80", 79.00, ["1 pc", "6 pcs box", "12 pcs box"]),
            ("Honey Cornflakes (Kelloggs)", "Crispy golden cornflakes drizzled with real honey. Sweeter, crunchier breakfast.", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=600&q=80", 145.00, ["250 g", "475 g", "875 g"]),
            ("Multi Grain Bread (Brown)", "100% wholegrain multigrain bread with seeds. High fibre, low GI breakfast choice.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 45.00, ["200 g", "400 g", "600 g"]),
        ],
        "baby-care": [
            ("Pampers Premium Care Diapers", "Ultra-soft Pampers diapers with wetness indicator. Gentle on baby's delicate skin.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 299.00, ["Small (4-8kg) 22pc", "Medium (6-11kg) 20pc", "Large (9-14kg) 18pc"]),
            ("Huggies Wonder Pants", "Stretchy, pull-up style baby pants that fit like underwear. Leakage protection up to 12 hours.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 349.00, ["Small 24pc", "Medium 22pc", "Large 20pc"]),
            ("Cerelac Wheat (Nestle)", "Stage 2 fortified wheat baby cereal with milk. 18 essential nutrients for infant growth.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 199.00, ["300 g", "500 g", "1 kg"]),
            ("Baby Dove Rich Moisture Lotion", "Hypoallergenic baby lotion with 1/4 moisturising cream. Tested on delicate skin.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 99.00, ["50 ml", "200 ml", "400 ml"]),
            ("Johnson's Baby Powder", "Gentle talc-free baby powder with soothing aloe vera. Keeps baby fresh and dry all day.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 89.00, ["50 g", "200 g", "500 g"]),
            ("Baby Shampoo (Johnson's No Tears)", "Gentle no-tears baby shampoo and conditioner. As gentle as water on baby eyes.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 79.00, ["100 ml", "200 ml", "400 ml"]),
            ("Farex Infant Cereal (Maize)", "Maize-based baby cereal for 6+ months with iron, calcium and vitamins. Easy to digest.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 175.00, ["300 g", "500 g", "1 kg"]),
            ("Mamaearth Baby Body Wash", "Natural baby body wash with organic ingredients. SLS-free, parabens-free, dermatologist tested.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 149.00, ["200 ml", "400 ml", "800 ml"]),
            ("Baby Wipes (Pampers Sensitive)", "Ultra-gentle alcohol-free baby wipes for sensitive skin. Clinically tested hypoallergenic.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 99.00, ["56 pc pack", "112 pc pack", "168 pc pack"]),
            ("Lactogen 1 Infant Formula", "Premium whey-based infant formula for 0-6 months. Closest to breast milk with DHA and ARA.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 445.00, ["200 g", "400 g", "800 g"]),
            ("Gripe Water (Woodwards)", "Traditional trusted remedy for colic and gas in infants. Gentle herbal formula.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 55.00, ["130 ml", "260 ml", "500 ml"]),
            ("Himalaya Baby Massage Oil", "Gentle baby oil with almond oil and Indian winter cherry. Nourishes and strengthens baby.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 69.00, ["100 ml", "200 ml", "500 ml"]),
            ("Mee Mee Baby Feeding Bottle", "Wide-neck anti-colic baby feeding bottle with slow-flow nipple. BPA-free safe plastic.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 199.00, ["120 ml", "250 ml", "300 ml"]),
            ("Baby Rash Cream (Chicco)", "Diaper rash prevention cream with zinc oxide and chamomile. Soothes and heals sore skin.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 149.00, ["50 g", "100 g", "200 g"]),
            ("Baby Nail Clipper Set", "Safe ergonomic baby nail clipper with magnifier and file. Gentle precision for tiny nails.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 99.00, ["Basic Set", "Premium Set", "Complete Kit"]),
        ],
        "health-wellness": [
            ("Dabur Chyawanprash", "Classic immunity booster with 41 Ayurvedic herbs, amla and ghee. Trusted for 100+ years.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 149.00, ["250 g", "500 g", "1 kg"]),
            ("Himalaya Septilin Syrup", "Ayurvedic immunity booster to fight infections and support respiratory health.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 89.00, ["100 ml", "200 ml", "450 ml"]),
            ("Patanjali Ashwagandha Tablet", "Pure herbal ashwagandha tablets for stress relief, energy and immunity improvement.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 79.00, ["60 tablets", "120 tablets", "240 tablets"]),
            ("Ensure Nutrition Drink (Abbott)", "Complete balanced adult nutrition powder with 26 vitamins and minerals and whey protein.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 349.00, ["200 g", "400 g", "900 g"]),
            ("Horlicks Health Drink", "Classic malt-based health drink with essential nutrients. Helps children grow taller, stronger.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 199.00, ["200 g", "500 g", "1 kg"]),
            ("Glucon-D Energy Drink", "Instant energy glucose drink to replenish electrolytes and fight fatigue.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 79.00, ["100 g", "250 g", "500 g"]),
            ("Multivitamin Tablets (Revital H)", "Daily multivitamin with ginseng, minerals and natural vitamin complex for men.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 299.00, ["30 tablets", "60 tablets", "90 tablets"]),
            ("Omega-3 Fish Oil Capsules", "Pure fish oil softgels with EPA and DHA. Supports heart, joint and brain health.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 349.00, ["30 caps", "60 caps", "120 caps"]),
            ("Whey Protein (Optimum Nutrition)", "Gold Standard 100% whey protein for muscle recovery and growth. 24g protein per serving.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 2499.00, ["500 g", "1 kg", "2 kg"]),
            ("BP Monitor (Omron HEM)", "Digital automatic blood pressure monitor with memory storage and irregular heartbeat indicator.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 1999.00, ["Basic Model", "Advanced Model", "Premium Model"]),
            ("Thermometer (Digital)", "Fast 30-second digital thermometer for oral, rectal and underarm use. Fever alert beep.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 199.00, ["Basic", "Standard", "Premium"]),
            ("Hand Sanitizer (Dettol)", "WHO-formulated 70% alcohol hand sanitizer. Kills 99.9% of germs without water.", "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80", 69.00, ["50 ml", "200 ml", "500 ml"]),
            ("Vitamin D3 Capsules (1000 IU)", "Daily Vitamin D3 supplement for strong bones, immunity and mood support.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 249.00, ["30 caps", "60 caps", "90 caps"]),
            ("Herbal Green Tea (Organic India)", "Certified organic tulsi green tea bags with antioxidants and calming adaptogens.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 99.00, ["25 bags", "50 bags", "100 bags"]),
            ("Triphala Powder (Patanjali)", "Classical Ayurvedic tridoshic herb blend for digestion, immunity and detoxification.", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80", 75.00, ["100 g", "250 g", "500 g"]),
        ],
        "pet-care": [
            ("Pedigree Adult Dog Food (Chicken)", "Complete balanced nutrition for adult dogs. Real chicken with wholesome grains for energy.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 199.00, ["400 g", "1.2 kg", "3 kg"]),
            ("Whiskas Cat Food (Tuna)", "Tender tuna-flavoured cat food with essential nutrients for adult cats. Vet recommended.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 149.00, ["85 g pack", "450 g pack", "1 kg pack"]),
            ("Royal Canin Mini Adult", "Premium nutritional kibble specially sized for small breed adult dogs (1-10 kg).", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 549.00, ["800 g", "2 kg", "4 kg"]),
            ("Dog Treats (Drools Chicken)", "Crunchy chicken flavoured dog treats with DHA. Great for training and rewarding.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 99.00, ["70 g", "200 g", "500 g"]),
            ("Cat Litter (Whiskas Clumping)", "Fast-clumping cat litter with superior odour control and dust-free technology.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 299.00, ["2.5 kg", "5 kg", "10 kg"]),
            ("Pet Shampoo (Wahl Puppy)", "Gentle tearless puppy shampoo with chamomile extract. Safe for weekly bathing.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 199.00, ["237 ml", "500 ml", "1 L"]),
            ("Dog Collar & Leash Set", "Adjustable nylon collar with matching leash. Comfortable, durable for daily walks.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 249.00, ["Small", "Medium", "Large"]),
            ("Tick & Flea Powder (Beaphar)", "Effective anti-parasite powder to kill and prevent ticks and fleas on pets.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 149.00, ["75 g", "150 g", "300 g"]),
            ("Bird Seed Mix (Taiyo)", "Complete nutritious seed mix for parrots, budgies and love birds. Sunflower, millet and more.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 89.00, ["250 g", "500 g", "1 kg"]),
            ("Aquarium Fish Food (Tetra)", "Balanced diet flake food for all tropical freshwater aquarium fish. Enhances colour.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 99.00, ["50 g", "100 g", "200 g"]),
            ("Pet Dental Chews (Greenies)", "Clinically proven dental chew that reduces tartar and freshens breath in dogs.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 199.00, ["85 g", "170 g", "340 g"]),
            ("Dog Bed (Soft Orthopedic)", "Memory foam orthopedic dog bed with waterproof lining and washable cover.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 899.00, ["Small 50x40cm", "Medium 70x55cm", "Large 90x70cm"]),
            ("Cat Scratcher & Toy Tower", "Multi-level cat activity tower with sisal scratching posts, hanging toys and perch.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 699.00, ["Basic", "Standard", "Deluxe"]),
            ("Pet Carrier Bag", "Airline-approved pet carrier with mesh ventilation and cushion mat. For cats and small dogs.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 599.00, ["Small", "Medium", "Large"]),
            ("Puppy Milk Replacer (Royal Canin)", "Complete liquid milk formula for puppies from birth. When mother's milk is unavailable.", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80", 299.00, ["200 ml", "500 ml", "1 L"]),
        ],
    }

    size_multipliers = [
        (0.75, "SML"),
        (1.00, "MED"),
        (1.60, "LRG"),
    ]

    total_products_count = 0

    for cat_slug, items in product_templates.items():
        category = category_map[cat_slug]
        for name, desc, img_url, base_price, units in items:
            sku_slug = name.upper().replace(" ", "-").replace("(", "").replace(")", "").replace("&", "AND").replace("'", "")[:25]
            
            # Base (Parent) product - Medium size
            base_prod = Product(
                category_id=category.id,
                name=name,
                description=desc,
                sku=f"PROD-{sku_slug}-MED",
                price=Decimal(str(round(base_price * size_multipliers[1][0], 2))),
                unit=units[1] if len(units) > 1 else "1 Unit",
                image_url=img_url,
                is_active=True,
                is_returnable=True,
                tax_rate=Decimal("5.00"),
                parent_id=None,
            )
            db.add(base_prod)
            await db.flush()
            total_products_count += 1

            # Base inventory
            inv_base = Inventory(
                product_id=base_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(inv_base)

            # Small Variant
            small_prod = Product(
                category_id=category.id,
                name=name,
                description=f"{name} ({units[0] if len(units) > 0 else 'Small'}).",
                sku=f"PROD-{sku_slug}-SML",
                price=Decimal(str(round(base_price * size_multipliers[0][0], 2))),
                unit=units[0] if len(units) > 0 else "Small",
                image_url=img_url,
                is_active=True,
                is_returnable=True,
                tax_rate=Decimal("5.00"),
                parent_id=base_prod.id,
            )
            db.add(small_prod)
            await db.flush()
            total_products_count += 1

            inv_small = Inventory(
                product_id=small_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(inv_small)

            # Large Variant
            large_prod = Product(
                category_id=category.id,
                name=name,
                description=f"{name} ({units[2] if len(units) > 2 else 'Large'}).",
                sku=f"PROD-{sku_slug}-LRG",
                price=Decimal(str(round(base_price * size_multipliers[2][0], 2))),
                unit=units[2] if len(units) > 2 else "Large",
                image_url=img_url,
                is_active=True,
                is_returnable=True,
                tax_rate=Decimal("5.00"),
                parent_id=base_prod.id,
            )
            db.add(large_prod)
            await db.flush()
            total_products_count += 1

            inv_large = Inventory(
                product_id=large_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(inv_large)

    print(f"  + Seeded {total_products_count} products and variants across 15 categories.")

    # 6. Seed Pickup Slots for next 5 days
    today = date.today()
    slots_created = 0
    for day_offset in range(5):
        slot_date = today + timedelta(days=day_offset)
        for start_h, end_h in [(10, 12), (16, 18)]:
            res = await db.execute(
                select(PickupSlot).where(
                    PickupSlot.store_id == store.id,
                    PickupSlot.date == slot_date,
                    PickupSlot.start_time == time(start_h, 0),
                )
            )
            if not res.scalar_one_or_none():
                slot = PickupSlot(
                    store_id=store.id,
                    date=slot_date,
                    start_time=time(start_h, 0),
                    end_time=time(end_h, 0),
                    capacity=store.pickup_capacity_per_slot,
                    booked_count=0,
                )
                db.add(slot)
                slots_created += 1

    # 7. Seed Sample Orders with Items for Staff & Customer Testing
    print("  - Seeding sample active & completed orders with real items...")
    cust_res = await db.execute(select(User).where(User.email == "customer@minidmart.com"))
    cust_user = cust_res.scalar_one_or_none()

    if cust_user:
        # Fetch some products to include in sample orders
        prods_res = await db.execute(select(Product).limit(15))
        sample_prods = list(prods_res.scalars().all())

        if len(sample_prods) >= 6:
            orders_to_seed = [
                ("ORD-781042-DELIVERY", OrderStatus.CONFIRMED, FulfillmentType.DELIVERY, [
                    (sample_prods[0], 2),
                    (sample_prods[1], 1),
                    (sample_prods[2], 3),
                ]),
                ("ORD-781043-PREPARING", OrderStatus.PREPARING, FulfillmentType.DELIVERY, [
                    (sample_prods[3], 1),
                    (sample_prods[4], 2),
                ]),
                ("ORD-781044-READY", OrderStatus.READY_FOR_PICKUP, FulfillmentType.PICKUP, [
                    (sample_prods[5], 2),
                    (sample_prods[0], 1),
                    (sample_prods[2], 2),
                ]),
                ("ORD-781045-DISPATCH", OrderStatus.OUT_FOR_DELIVERY, FulfillmentType.DELIVERY, [
                    (sample_prods[1], 2),
                    (sample_prods[3], 1),
                ]),
                ("ORD-781046-DELIVERED", OrderStatus.COMPLETED, FulfillmentType.DELIVERY, [
                    (sample_prods[4], 3),
                    (sample_prods[5], 1),
                ]),
            ]

            for ord_num, ord_status, ful_type, items_spec in orders_to_seed:
                subtotal = sum(p.price * qty for p, qty in items_spec)
                tax = round(subtotal * Decimal("0.05"), 2)
                total = subtotal + tax

                sample_order = Order(
                    order_number=ord_num,
                    user_id=cust_user.id,
                    status=ord_status,
                    fulfillment_type=ful_type,
                    subtotal=subtotal,
                    tax=tax,
                    total=total,
                )
                db.add(sample_order)
                await db.flush()

                for prod_item, qty in items_spec:
                    db.add(
                        OrderItem(
                            order_id=sample_order.id,
                            product_id=prod_item.id,
                            quantity=qty,
                            unit_price_at_order=prod_item.price,
                        )
                    )

                db.add(
                    OrderStatusLog(
                        order_id=sample_order.id,
                        from_status=None,
                        to_status=ord_status,
                        changed_by=cust_user.id,
                        note="Seeded demo order with items.",
                    )
                )

            print("  + Seeded 5 demo orders with real items and quantities.")

    await db.commit()
    print("[SUCCESS] Database seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed())
