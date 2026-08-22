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

async def seed(db: Optional[AsyncSession] = None):
    if db is not None:
        await _run_seed(db)
    else:
        async with AsyncSessionLocal() as db_session:
            await _run_seed(db_session)

async def _run_seed(db: AsyncSession):
    print("[SEED] Starting Mini D-Mart Database Seeding...")

    # 1. Clean up catalog tables to prevent duplicates and stale relationships
    # Using DELETE instead of TRUNCATE for SQLite compatibility (used in tests)
    print("  - Cleaning up old catalog tables...")
    await db.execute(text("DELETE FROM inventory;"))
    await db.execute(text("DELETE FROM cart_items;"))
    await db.execute(text("DELETE FROM order_items;"))
    await db.execute(text("DELETE FROM return_requests;"))
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
            name="Store Staff Member",
            phone="+919876543211",
            role=Role.STAFF,
            is_active=True,
        )
        db.add(staff)
        print("  + Created Staff User (staff@minidmart.com)")
    else:
        staff.password_hash = get_password_hash("Staff@123")
        staff.is_active = True

    # 4. Seed Test Customer Accounts
    customers_to_seed = [
        ("customer@minidmart.com", "Customer@123", "Demo Customer", "+919876543212"),
        ("end2end_customer@example.com", "Password123", "End-to-End Customer", "+919876543213"),
    ]
    for c_email, c_pass, c_name, c_phone in customers_to_seed:
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

    # Define product templates across 7 categories (25 products per category)
    # Total unique base product templates = 175.
    # Each will have 3 variants (Small, Medium, Large size/weight). Total = 525 products!
    product_templates = {
        "fruits-vegetables": [
            ("Ratnagiri Alphonso Mango", "Sweet, aromatic, and rich Ratnagiri Alphonso mangoes.", "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80", 150.00, ["250 g", "500 g", "1 kg"]),
            ("Organic Red Tomatoes", "Farm-fresh juicy organic red tomatoes.", "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80", 25.00, ["250 g", "500 g", "1 kg"]),
            ("Robusta Bananas", "Sweet and energy-rich Cavendish Robusta bananas.", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80", 30.00, ["3 pcs", "6 pcs", "1 Dozen"]),
            ("Fresh Spinach (Palak)", "Crispy green spinach leaves, cleaned and washed.", "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 15.00, ["100 g", "250 g", "500 g"]),
            ("Hybrid Red Onions", "High-quality farm red onions with a crisp texture.", "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80", 20.00, ["500 g", "1 kg", "2 kg"]),
            ("New Crop Potatoes", "Freshly harvested earthy potatoes, perfect for boiling/frying.", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80", 18.00, ["500 g", "1 kg", "2 kg"]),
            ("Fresh Cauliflower", "Clean white cauliflower heads, rich in nutrients.", "https://images.unsplash.com/photo-1568584711075-3d021a7c3ec3?auto=format&fit=crop&w=600&q=80", 22.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Local Red Carrots", "Sweet and crunchy local red carrots.", "https://images.unsplash.com/photo-1598170845058-32b996a6bd37?auto=format&fit=crop&w=600&q=80", 20.00, ["250 g", "500 g", "1 kg"]),
            ("Green Capsicum", "Glossy and crisp green bell peppers.", "https://images.unsplash.com/photo-1563565088-91349b139360?auto=format&fit=crop&w=600&q=80", 24.00, ["200 g", "500 g", "1 kg"]),
            ("Seedless Papaya", "Sweet orange pulped ripe papaya fruit.", "https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=600&q=80", 35.00, ["500 g", "1 kg", "1.5 kg"]),
            ("Fresh Juicy Lemon", "Sour and tangy fresh local lemons.", "https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=600&q=80", 12.00, ["3 pcs", "6 pcs", "12 pcs"]),
            ("Sweet Pomegranate", "Juicy ruby-red arils, packed with antioxidants.", "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=600&q=80", 70.00, ["250 g", "500 g", "1 kg"]),
            ("Green Apple (Imported)", "Crisp and tangy green apples from New Zealand.", "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=600&q=80", 90.00, ["250 g", "500 g", "1 kg"]),
            ("Valencia Oranges", "Sweet and juice-filled imported Valencia oranges.", "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=600&q=80", 65.00, ["500 g", "1 kg", "2 kg"]),
            ("English Cucumber", "Long, thin-skinned seedless salad cucumbers.", "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=600&q=80", 18.00, ["250 g", "500 g", "1 kg"]),
            ("Fresh Ginger (Adrak)", "Tangy and hot fresh ginger roots.", "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=600&q=80", 20.00, ["100 g", "250 g", "500 g"]),
            ("Fresh Garlic (Lahsun)", "Pungent and flavorful garlic bulbs.", "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=600&q=80", 25.00, ["100 g", "250 g", "500 g"]),
            ("Lady Finger (Bhindi)", "Tender and green lady fingers.", "https://images.unsplash.com/photo-1625938146369-adc83368bda7?auto=format&fit=crop&w=600&q=80", 20.00, ["250 g", "500 g", "1 kg"]),
            ("Sweet Watermelon", "Juicy and hydrating sweet dark green watermelon.", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80", 40.00, ["1.5 kg", "3 kg", "5 kg"]),
            ("Fresh Pineapple", "Sweet and tropical raw pineapples.", "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80", 50.00, ["1 pc", "2 pcs", "3 pcs"]),
            ("Green Peas (Matar)", "Fresh green peas, sweet and tender.", "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=600&q=80", 30.00, ["250 g", "500 g", "1 kg"]),
            ("Button Mushroom", "Fresh and clean white button mushrooms.", "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80", 35.00, ["1 pack", "2 packs", "3 packs"]),
            ("Fresh Coconut", "De-husked fresh coconut with sweet water inside.", "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=600&q=80", 28.00, ["1 pc", "2 pcs", "4 pcs"]),
            ("Sweet Sweetcorn", "Juicy golden yellow sweetcorn cobs.", "https://images.unsplash.com/photo-1551754625-70c90487aa35?auto=format&fit=crop&w=600&q=80", 15.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Broccoli", "Fresh green broccoli florets.", "https://images.unsplash.com/photo-1453227588063-bb302b62f50b?auto=format&fit=crop&w=600&q=80", 45.00, ["250 g", "500 g", "1 kg"])
        ],
        "dairy-bakery": [
            ("Amul Pasteurised Butter", "Creamy, salted butter made from pure cow milk.", "/images/products/prod-butter-01.png", 55.00, ["100 g", "250 g", "500 g"]),
            ("Mother Dairy Toned Milk", "Pasteurised toned milk with standard fat content.", "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80", 28.00, ["500 ml", "1 L", "2 L"]),
            ("Britannia Premium Bread", "Soft and nutritious whole wheat sandwich bread.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 25.00, ["200 g", "400 g", "700 g"]),
            ("Fresh Malai Paneer", "Creamy, dense cottage cheese for curries.", "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", 85.00, ["200 g", "500 g", "1 kg"]),
            ("Epigamia Greek Yogurt", "Thick and protein-rich strawberry Greek yogurt.", "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80", 40.00, ["90 g", "180 g", "400 g"]),
            ("Pure Cow Ghee", "Aromatic premium clarified cow ghee.", "https://images.unsplash.com/photo-1589733901241-5e514f27b550?auto=format&fit=crop&w=600&q=80", 130.00, ["200 ml", "500 ml", "1 L"]),
            ("Amul Cheese Slices", "Processed cheese slices for burgers and sandwiches.", "https://images.unsplash.com/photo-1528256446116-37e4070a2f85?auto=format&fit=crop&w=600&q=80", 80.00, ["100 g", "200 g", "400 g"]),
            ("Fresh Curd (Dahi)", "Creamy set curd made from pasteurised milk.", "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80", 25.00, ["200 g", "400 g", "1 kg"]),
            ("Britannia Cheese Block", "Rich cheddar processed cheese block.", "https://images.unsplash.com/photo-1528256446116-37e4070a2f85?auto=format&fit=crop&w=600&q=80", 120.00, ["200 g", "500 g", "1 kg"]),
            ("Fresh Brown Eggs", "Protein-rich farm brown eggs.", "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80", 45.00, ["6 pcs", "12 pcs", "30 pcs"]),
            ("Amul Gold Full Cream Milk", "High-fat full cream rich pasteurised milk.", "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80", 33.00, ["500 ml", "1 L", "2 L"]),
            ("Flavoured Milkshake", "Delicious chocolate flavoured cold milk shake.", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80", 30.00, ["180 ml", "360 ml", "500 ml"]),
            ("Fresh Whipping Cream", "Rich whipping dairy cream for desserts.", "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80", 60.00, ["250 ml", "500 ml", "1 L"]),
            ("Amul Masti Spiced Buttermilk", "Cooling spiced salted buttermilk.", "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80", 15.00, ["200 ml", "500 ml", "1 L"]),
            ("Nestle Milkmaid", "Sweetened condensed milk for sweet dishes.", "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80", 140.00, ["200 g", "400 g", "800 g"]),
            ("Chocolate Cream Cake", "Soft eggless bakery chocolate cream cake.", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80", 199.00, ["250 g", "500 g", "1 kg"]),
            ("Multigrain Bread", "Healthy dietary fiber multigrain bread loaf.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 35.00, ["200 g", "400 g", "700 g"]),
            ("Milk Rusk", "Crispy twice-baked sweet milk toast biscuits.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 40.00, ["150 g", "300 g", "600 g"]),
            ("Garlic Bread Loaf", "Bakery fresh salted garlic and herb butter bread.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 50.00, ["150 g", "300 g", "500 g"]),
            ("Choco Chip Muffins", "Soft bakery choco chip muffins pack.", "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80", 60.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Fruit Buns Pack", "Sweet vanilla and tutti frutti buns pack.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 20.00, ["2 pcs", "4 pcs", "8 pcs"]),
            ("Nupur Wheat Flour (Atta)", "100% pure stoneground chakki wheat flour.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 45.00, ["1 kg", "5 kg", "10 kg"]),
            ("Fresh Pizza Base", "Bakery wheat pizza bases pack.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 30.00, ["2 pcs", "4 pcs", "6 pcs"]),
            ("Almond Cookies Pack", "Rich bakery almond crunch cookies.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 80.00, ["150 g", "300 g", "500 g"]),
            ("Strawberry Ice Cream", "Creamy double strawberry ripple ice cream tub.", "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=600&q=80", 120.00, ["100 ml", "500 ml", "1 L"])
        ],
        "snacks-beverages": [
            ("Tata Tea Gold Leaf", "Fine CTC tea leaves with 15% long tea leaves.", "/images/products/prod-tea-01.png", 95.00, ["100 g", "250 g", "500 g"]),
            ("Coca-Cola Soft Drink", "Tangy, bubbly and carbonated soft drink bottle.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "1.5 L"]),
            ("Nescafe Classic Coffee", "100% pure soluble coffee beans powder.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 80.00, ["50 g", "100 g", "200 g"]),
            ("Real Mixed Fruit Juice", "Rich natural mixed fruit beverage juice.", "https://images.unsplash.com/photo-1622597467836-f3285f367680?auto=format&fit=crop&w=600&q=80", 30.00, ["200 ml", "1 L", "2 L"]),
            ("Red Bull Energy Drink", "Vitalizes body and mind energy drink can.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 120.00, ["250 ml", "4-Pack", "8-Pack"]),
            ("Paper Boat Aamras Juice", "Rich pulpy mango fruit beverage juice.", "https://images.unsplash.com/photo-1622597467836-f3285f367680?auto=format&fit=crop&w=600&q=80", 35.00, ["200 ml", "500 ml", "1 L"]),
            ("Pepsi Carbonated Cola", "Bubbly and sweet cola soft drink.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 38.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Tropicana Orange Juice", "100% pure squeezed orange juice pack.", "https://images.unsplash.com/photo-1622597467836-f3285f367680?auto=format&fit=crop&w=600&q=80", 35.00, ["200 ml", "1 L", "2 L"]),
            ("Taj Mahal Black Tea", "Premium CTC and long leaf orange pekoe tea.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 120.00, ["100 g", "250 g", "500 g"]),
            ("Bournvita Chocolate Powder", "Malted chocolate drink powder with nutrients.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 110.00, ["200 g", "500 g", "1 kg"]),
            ("Sprite Lime Soft Drink", "Crisp lemon-lime carbonated clear soft drink.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2 L"]),
            ("Minute Maid Pulpy Orange", "Tangy orange juice with real orange pulp.", "https://images.unsplash.com/photo-1622597467836-f3285f367680?auto=format&fit=crop&w=600&q=80", 35.00, ["400 ml", "1 L", "1.75 L"]),
            ("Lipton Green Tea Honey", "Healthy green tea bags with honey lemon flavor.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 145.00, ["25 pcs", "50 pcs", "100 pcs"]),
            ("Boost Energy Malt Drink", "Chocolate energy malt nutrition powder.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 125.00, ["200 g", "500 g", "1 kg"]),
            ("Fanta Orange Drink", "Fruity and sweet orange carbonated soft drink.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2 L"]),
            ("Appy Fizz Juice", "Apple juice carbonated sparkling beverage.", "https://images.unsplash.com/photo-1622597467836-f3285f367680?auto=format&fit=crop&w=600&q=80", 20.00, ["250 ml", "600 ml", "1.5 L"]),
            ("Brooke Bond Red Label Tea", "High quality CTC tea leaves with healthy herbs.", "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80", 100.00, ["100 g", "250 g", "500 g"]),
            ("Horlicks Malt Drink", "Classic nutrition malted milk powder.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 130.00, ["200 g", "500 g", "1 kg"]),
            ("Thums Up Soft Drink", "Strong, spicy carbonated cola beverage.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["250 ml", "750 ml", "2.25 L"]),
            ("Monster Energy Drink", "L-Carnitine and Taurine carbonated energy can.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 110.00, ["350 ml", "2-Pack", "4-Pack"]),
            ("Bru Instant Coffee", "Blend of 70% coffee and 30% chicory powder.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80", 75.00, ["50 g", "100 g", "200 g"]),
            ("Bisk Farm Marie Biscuits", "Crispy and light wheat flour tea biscuits.", "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", 10.00, ["100 g", "250 g", "500 g"]),
            ("Diet Coke Soft Drink", "Zero calorie sugar-free cola beverage.", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80", 40.00, ["300 ml", "750 ml", "1.5 L"]),
            ("Amul Kool Koko Drink", "Rich chocolate cold milk beverage bottle.", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80", 25.00, ["200 ml", "400 ml", "600 ml"]),
            ("Aashirvaad Whole Black Pepper", "Pungent and hot whole black peppercorns.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 40.00, ["50 g", "100 g", "200 g"])
        ],
        "instant-frozen-food": [
            ("Maggi 2-Minute Noodles", "Classic instant masala noodles with spice packet.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 14.00, ["70 g", "280 g (4-Pack)", "560 g (8-Pack)"]),
            ("McCain French Fries", "Crispy, golden frozen potato French fries pack.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 65.00, ["320 g", "750 g", "1.25 kg"]),
            ("Knorr Classic Tomato Soup", "Thick and savory tomato instant soup mix.", "https://images.unsplash.com/photo-1547592165-e1d17fed6006?auto=format&fit=crop&w=600&q=80", 15.00, ["20 g", "40 g", "80 g"]),
            ("Safal Frozen Green Peas", "Individually quick frozen sweet tender green peas.", "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=600&q=80", 40.00, ["200 g", "500 g", "1 kg"]),
            ("Yippee Magic Masala Noodles", "Non-sticky, round block magic masala noodles.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 14.00, ["70 g", "280 g (4-Pack)", "560 g (8-Pack)"]),
            ("Ching's Schezwan Noodles", "Spicy schezwan hot instant stir-fry noodles.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 15.00, ["75 g", "300 g (4-Pack)", "600 g (8-Pack)"]),
            ("Haldiram Frozen Samosa", "Spicy potato filled traditional frozen samosa pack.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 80.00, ["4 pcs", "8 pcs", "16 pcs"]),
            ("ITC Chicken Nuggets", "Crispy golden fried frozen chicken breast nuggets.", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80", 110.00, ["200 g", "400 g", "800 g"]),
            ("McCain Potato Bites", "Frozen chili garlic potato nuggets.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 60.00, ["200 g", "420 g", "750 g"]),
            ("Knorr Sweet Corn Soup", "Thick chicken/veg sweet corn instant soup mix.", "https://images.unsplash.com/photo-1547592165-e1d17fed6006?auto=format&fit=crop&w=600&q=80", 15.00, ["20 g", "40 g", "80 g"]),
            ("safal Frozen Sweet Corn", "Sweet and tender quick frozen golden sweetcorn kernels.", "https://images.unsplash.com/photo-1551754625-70c90487aa35?auto=format&fit=crop&w=600&q=80", 40.00, ["200 g", "500 g", "1 kg"]),
            ("MTR Instant Rava Idli Mix", "Ready to cook semolina (rava) idli mix.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 55.00, ["200 g", "500 g", "1 kg"]),
            ("MTR Instant Gulab Jamun", "Sweet dessert milk solid balls mix.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 60.00, ["100 g", "200 g", "500 g"]),
            ("Frozen Mixed Vegetables", "Quick frozen carrot, peas, beans mix.", "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=600&q=80", 40.00, ["200 g", "500 g", "1 kg"]),
            ("Maggi Cup Noodles Masala", "Instant cup noodles with hot water line.", "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80", 40.00, ["60 g", "2-Pack", "4-Pack"]),
            ("Act II Microwave Popcorn", "Buttery instant microwave popcorn bags.", "https://images.unsplash.com/photo-1518047601542-79f18c655718?auto=format&fit=crop&w=600&q=80", 35.00, ["33 g", "99 g (3-Pack)", "198 g (6-Pack)"]),
            ("McCain Smileys", "Frozen smileys shaped mashed potato crisps.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 65.00, ["200 g", "400 g", "750 g"]),
            ("MTR Instant Poha Mix", "Mildly spiced rice flakes breakfast poha mix.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 25.00, ["80 g", "160 g", "400 g"]),
            ("Haldiram Frozen Paneer Paratha", "Layered wheat parathas stuffed with paneer.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 90.00, ["2 pcs", "4 pcs", "8 pcs"]),
            ("Safal Frozen Jackfruit", "Frozen raw cut jackfruit chunks.", "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=600&q=80", 50.00, ["250 g", "500 g", "1 kg"]),
            ("Ching's Secret Hot Garlic Soup", "Instant hot and sour garlic soup packet.", "https://images.unsplash.com/photo-1547592165-e1d17fed6006?auto=format&fit=crop&w=600&q=80", 10.00, ["15 g", "30 g", "60 g"]),
            ("MTR Instant Upma Mix", "Ready to cook semolina breakfast upma mix.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 25.00, ["80 g", "200 g", "500 g"]),
            ("Frozen Chicken Spring Rolls", "Crispy filled chicken spring rolls pack.", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80", 120.00, ["4 pcs", "8 pcs", "16 pcs"]),
            ("MTR Instant Idli Batter", "Fermented rice and black gram idli batter.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 60.00, ["500 g", "1 kg", "2 kg"]),
            ("McCain Aloo Tikki", "Frozen spiced potato patties (tikkis) pack.", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", 65.00, ["200 g", "400 g", "750 g"])
        ],
        "munchies-chips": [
            ("Lay's Classic Salted Chips", "Crispy, golden, and thin salted potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["30 g", "50 g", "95 g"]),
            ("Doritos Nacho Cheese Chips", "Crunchy tortilla chips loaded with nacho cheese flavor.", "https://images.unsplash.com/photo-1518047601542-79f18c655718?auto=format&fit=crop&w=600&q=80", 35.00, ["23 g", "75 g", "140 g"]),
            ("Kurkure Masala Munch", "Crispy and spicy corn puff strands.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Bingo! Mad Angles Masala", "Triangle-shaped crispy potato and corn chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Haldiram Nagpur Aloo Bhujia", "Crispy spicy potato moth bean noodles snack.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 35.00, ["150 g", "350 g", "1 kg"]),
            ("Pringles Sour Cream & Onion", "Saddle-shaped stacked potato chips in can.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 95.00, ["50 g", "110 g", "180 g"]),
            ("Uncle Chipps Spicy Treat", "Traditional spicy flavored crinkle cut potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["30 g", "50 g", "95 g"]),
            ("Bingo! Tedhe Medhe Masala", "Spicy and crunchy twisted snack sticks.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Haldiram Nagpur Sev Murmura", "Light salted puffed rice and chickpea noodles.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 30.00, ["150 g", "300 g", "600 g"]),
            ("Pringles Potato Chips Original", "Classic salted potato chips in red tube cylinder.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 95.00, ["50 g", "110 g", "180 g"]),
            ("Lay's India's Magic Masala", "Spicy and tangy crinkled potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["30 g", "50 g", "95 g"]),
            ("Doritos Sweet Chili Chips", "Spicy and sweet tortilla chips in purple bag.", "https://images.unsplash.com/photo-1518047601542-79f18c655718?auto=format&fit=crop&w=600&q=80", 35.00, ["23 g", "75 g", "140 g"]),
            ("Kurkure Green Chutney Style", "Spicy green chili flavored corn puffs.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Bingo! Mad Angles Cheese", "Cheese flavored crunchy triangle crisps.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Haldiram Nagpur Moong Dal", "Fried salted split green gram dal snack.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 35.00, ["150 g", "350 g", "1 kg"]),
            ("Pringles Spicy Hot", "Spicy hot red chili stacked potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 95.00, ["50 g", "110 g", "180 g"]),
            ("Uncle Chipps Salted Treat", "Crinkled classic salted potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["30 g", "50 g", "95 g"]),
            ("Crax Corn Rings", "Crunchy roasted corn rings snack.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 10.00, ["25 g", "50 g", "90 g"]),
            ("Haldiram Nagpur Salted Peanut", "Crunchy roasted salted peanuts.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 20.00, ["100 g", "200 g", "400 g"]),
            ("Pringles Barbecue Chips", "Barbecue smoky flavored potato chips in tube.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 95.00, ["50 g", "110 g", "180 g"]),
            ("Lay's West Indies Hot Sweet", "Spicy and sweet flavored potato chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 20.00, ["30 g", "50 g", "95 g"]),
            ("Doritos Roasted Garlic Chips", "Garlic flavored crunchy tortilla chips.", "https://images.unsplash.com/photo-1518047601542-79f18c655718?auto=format&fit=crop&w=600&q=80", 35.00, ["23 g", "75 g", "140 g"]),
            ("Kurkure Chili Chatkaa", "Very hot chili flavored corn puffs.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Bingo! Mad Angles Achaari", "Tangy mango pickle flavored potato triangle chips.", "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80", 10.00, ["30 g", "50 g", "90 g"]),
            ("Haldiram Nagpur Chana Dal", "Fried salted split Bengal gram dal snack.", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", 35.00, ["150 g", "350 g", "1 kg"])
        ],
        "personal-care": [
            ("Dettol Liquid Handwash", "Trusted germ protection original liquid handwash.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 38.00, ["175 ml", "675 ml (Refill)", "900 ml (Pump)"]),
            ("Colgate MaxFresh Gel", "Intense cooling blue gel toothpaste with crystals.", "https://images.unsplash.com/photo-1559599101-309b58296a27?auto=format&fit=crop&w=600&q=80", 65.00, ["80 g", "150 g", "300 g (2-Pack)"]),
            ("Dove Cream Beauty Bar", "Mild moisturizing beauty soap bar.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 50.00, ["75 g", "125 g", "375 g (3-Pack)"]),
            ("Head & Shoulders Shampoo", "Anti-dandruff cool menthol daily hair shampoo.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 90.00, ["180 ml", "340 ml", "650 ml"]),
            ("Nivea Soft Moisturiser", "Light non-greasy soft moisturizing cream.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 50.00, ["50 ml", "100 ml", "200 ml"]),
            ("Pears Pure & Gentle Soap", "Glycerine-rich hypoallergenic transparent soap.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 45.00, ["75 g", "125 g", "375 g (3-Pack)"]),
            ("Sensodyne Fresh Mint", "Sensitivity relief daily fluoride gel toothpaste.", "https://images.unsplash.com/photo-1559599101-309b58296a27?auto=format&fit=crop&w=600&q=80", 80.00, ["75 g", "150 g", "300 g (2-Pack)"]),
            ("Fiama Shower Gel Lemon", "Tangy lemon and jojoba beads shower gel.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 99.00, ["100 ml", "250 ml", "500 ml"]),
            ("Gillette Shaving Foam", "Classic sensitive skin shave foam cream.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 79.00, ["100 g", "196 g", "400 g (2-Pack)"]),
            ("Himalaya Neem Face Wash", "Purifying herbal neem and turmeric acne control gel.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 65.00, ["50 ml", "100 ml", "200 ml"]),
            ("Dettol Original Soap Bar", "Antibacterial germ protection orange soap bar.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 35.00, ["75 g", "125 g", "375 g (3-Pack)"]),
            ("Colgate Cavity Protection", "Traditional white calcium fluoride toothpaste.", "https://images.unsplash.com/photo-1559599101-309b58296a27?auto=format&fit=crop&w=600&q=80", 50.00, ["80 g", "150 g", "300 g (2-Pack)"]),
            ("Lifebuoy Total Soap Bar", "Red active germ protection soap bar.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 30.00, ["75 g", "125 g", "375 g (3-Pack)"]),
            ("Clinic Plus Strong Shampoo", "Milk protein daily strength hair shampoo.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 65.00, ["175 ml", "340 ml", "650 ml"]),
            ("Nivea Body Milk Lotion", "Deep moisture cocoa butter dry skin lotion.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 120.00, ["75 ml", "200 ml", "400 ml"]),
            ("Pond's Dreamflower Talc", "Fragrant cooling pink body talcum powder.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 50.00, ["50 g", "100 g", "200 g"]),
            ("Colgate Kids Bubble Fruit", "Gentle cavity protection gel toothpaste for kids.", "https://images.unsplash.com/photo-1559599101-309b58296a27?auto=format&fit=crop&w=600&q=80", 40.00, ["40 g", "80 g", "160 g (2-Pack)"]),
            ("Fiama Peach Shower Gel", "Creamy peach and avocado oil shower cream.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 99.00, ["100 ml", "250 ml", "500 ml"]),
            ("Park Avenue Shave Lotion", "Cooling menthol after shave splash lotion.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 115.00, ["50 ml", "100 ml", "200 ml"]),
            ("Clean & Clear Face Wash", "Foaming oil-free pimple control face wash.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 65.00, ["50 ml", "100 ml", "150 ml"]),
            ("Santoor Sandalwood Soap", "Traditional sandalwood and turmeric skin soap.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 35.00, ["75 g", "125 g", "375 g (3-Pack)"]),
            ("CloseUp Red Hot Gel", "Spicy hot red gel cavity protection toothpaste.", "https://images.unsplash.com/photo-1559599101-309b58296a27?auto=format&fit=crop&w=600&q=80", 60.00, ["80 g", "150 g", "300 g (2-Pack)"]),
            ("Savlon Liquid Handwash", "Gentle antiseptic herbal liquid handwash.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 35.00, ["175 ml", "675 ml (Refill)", "900 ml (Pump)"]),
            ("Pantene Silky Shampoo", "Pro-V formula smooth and silky hair shampoo.", "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80", 90.00, ["180 ml", "340 ml", "650 ml"]),
            ("Vaseline Petroleum Jelly", "Pure skin protection moisturizing petroleum jelly.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80", 45.00, ["42 g", "85 g", "150 g"])
        ],
        "household-essentials": [
            ("Vim Lemon Dishwash Gel", "Concentrated lemon formula degreasing dishwash gel.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 55.00, ["250 ml", "500 ml", "750 ml"]),
            ("Surf Excel Easy Wash", "Tough stain removal laundry detergent powder.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 75.00, ["500 g", "1 kg", "3 kg"]),
            ("Lizol Floor Cleaner", "Kills 99.9% germs citrus disinfectant floor cleaner.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 85.00, ["200 ml", "500 ml", "1 L"]),
            ("Harpic Toilet Cleaner", "10/10 blue liquid acid toilet disinfectant.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 88.00, ["200 ml", "500 ml", "1 L"]),
            ("Comfort Fabric Conditioner", "Pink lily soft and fragrant laundry conditioner.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 55.00, ["200 ml", "860 ml", "1.6 L"]),
            ("Ariel Complete Powder", "Advanced stain removal laundry detergent powder.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 80.00, ["500 g", "1 kg", "3 kg"]),
            ("Dettol Antiseptic Liquid", "Classic first-aid wound disinfectant antiseptic liquid.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 40.00, ["100 ml", "500 ml", "1 L"]),
            ("Pril Lime Liquid", "Grease buster lime active gel dishwash liquid.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 55.00, ["225 ml", "425 ml", "750 ml"]),
            ("Colin Glass Cleaner", "Streak-free shine blue window glass cleaner.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 85.00, ["250 ml", "500 ml", "1 L"]),
            ("Godrej Aer Spray Petal", "Fragrant rose petal air freshener room spray.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 140.00, ["220 ml", "2-Pack", "3-Pack"]),
            ("Vim Lemon Dishwash Bar", "Anti-smell green dishwash soap bar.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 10.00, ["95 g", "300 g", "800 g (3-Pack)"]),
            ("Surf Excel Matic Liquid", "Top load liquid laundry detergent bottle.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 120.00, ["500 ml", "1 L", "2 L"]),
            ("Lizol Lavender Cleaner", "Floral lavender disinfectant floor cleaner.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 85.00, ["200 ml", "500 ml", "1 L"]),
            ("Harpic Red Flush Cleaner", "Lime scales removal toilet flush active gel.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 88.00, ["200 ml", "500 ml", "1 L"]),
            ("Comfort Blue Conditioner", "Morning fresh soft fabric conditioner.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 55.00, ["200 ml", "860 ml", "1.6 L"]),
            ("Rin Detergent Powder", "Whiteness champion laundry detergent powder.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 50.00, ["500 g", "1 kg", "3 kg"]),
            ("Dettol Disinfectant Spray", "Spring blossom multi-surface sanitizer spray.", "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 159.00, ["225 ml", "450 ml", "675 ml (3-Pack)"]),
            ("Exo Dishwash Bar", "Ginger active grease buster dishwash bar.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 10.00, ["90 g", "300 g", "750 g (3-Pack)"]),
            ("Hit Mosquito Killer Spray", "Instant kill red mosquito aerosol spray.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 110.00, ["200 ml", "400 ml", "625 ml"]),
            ("Godrej Aer Spray Cool", "Ocean breeze air freshener spray.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 140.00, ["220 ml", "2-Pack", "3-Pack"]),
            ("Odonil Room Freshener Hanger", "Jasmine scented room freshener gel block.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 45.00, ["50 g", "100 g (2-Pack)", "200 g (4-Pack)"]),
            ("Ariel Matic Liquid", "Front load washing machine liquid detergent.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 130.00, ["500 ml", "1 L", "2 L"]),
            ("Baygon Cockroach Spray", "Instant kill cockroach crawling insect spray.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 100.00, ["200 ml", "400 ml", "600 ml"]),
            ("Rin Detergent Soap Bar", "Clean and bright laundry wash soap bar.", "https://images.unsplash.com/photo-1569173112611-52a7cd38bec5?auto=format&fit=crop&w=600&q=80", 10.00, ["120 g", "250 g (2-Pack)", "500 g (4-Pack)"]),
            ("Vim Anti-Smell Pudina Gel", "Pudina active anti-smell dishwash gel.", "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80", 60.00, ["250 ml", "500 ml", "750 ml"])
        ]
    }

    # 6. Seed Products (175 base products * 3 variants = 525 products!)
    print("  - Generating 525 products with multi-size variants...")
    total_seeded_count = 0
    import re

    for category_slug, templates in product_templates.items():
        cat = category_map[category_slug]
        for name, desc, img, base_price, sizes in templates:
            # Clean name for unique SKU generation
            clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', name)
            words = [w.upper() for w in clean_name.split() if w]
            sku_prefix = "PROD-" + "-".join(words)

            # Insert Base Product (Smallest Size)
            base_size = sizes[0]
            base_sku = f"{sku_prefix}-BASE"
            
            base_prod = Product(
                category_id=cat.id,
                name=name,
                description=desc,
                sku=base_sku,
                price=Decimal(f"{base_price:.2f}"),
                unit=base_size,
                image_url=img,
                is_returnable=True,
                is_active=True,
            )
            db.add(base_prod)
            await db.flush() # flush to get base_prod.id
            total_seeded_count += 1

            # Seed inventory for Base Product
            base_inv = Inventory(
                product_id=base_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(base_inv)

            # Insert Sibling Variants (Medium & Large Sizes)
            # Size 1 (Medium) - price multiplier 1.8x
            med_size = sizes[1]
            med_sku = f"{sku_prefix}-MED"
            med_price = base_price * 1.8
            med_prod = Product(
                category_id=cat.id,
                name=name,
                description=desc,
                sku=med_sku,
                price=Decimal(f"{med_price:.2f}"),
                unit=med_size,
                image_url=img,
                is_returnable=True,
                parent_id=base_prod.id,
                is_active=True,
            )
            db.add(med_prod)
            await db.flush()
            total_seeded_count += 1

            med_inv = Inventory(
                product_id=med_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(med_inv)

            # Size 2 (Large) - price multiplier 3.2x
            large_size = sizes[2]
            large_sku = f"{sku_prefix}-LRG"
            large_price = base_price * 3.2
            large_prod = Product(
                category_id=cat.id,
                name=name,
                description=desc,
                sku=large_sku,
                price=Decimal(f"{large_price:.2f}"),
                unit=large_size,
                image_url=img,
                is_returnable=True,
                parent_id=base_prod.id,
                is_active=True,
            )
            db.add(large_prod)
            await db.flush()
            total_seeded_count += 1

            large_inv = Inventory(
                product_id=large_prod.id,
                store_id=store.id,
                quantity_available=100,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(large_inv)

    print(f"  + Seeded {total_seeded_count} products and variants.")

    # 7. Seed Pickup Slots (~10 slots over next 5 days, 2 slots per day, capacity 5 each)
    today = date.today()
    slot_times = [
        (time(10, 0), time(12, 0)),
        (time(16, 0), time(18, 0)),
    ]

    for day_offset in range(5):
        slot_date = today + timedelta(days=day_offset)
        for start_t, end_t in slot_times:
            res_slot = await db.execute(
                select(PickupSlot).where(
                    PickupSlot.store_id == store.id,
                    PickupSlot.date == slot_date,
                    PickupSlot.start_time == start_t,
                )
            )
            if not res_slot.scalar_one_or_none():
                slot = PickupSlot(
                    store_id=store.id,
                    date=slot_date,
                    start_time=start_t,
                    end_time=end_t,
                    capacity=5,
                    booked_count=0,
                )
                db.add(slot)

    await db.commit()
    print("[SUCCESS] Database seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed())
