using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace first_pro.Controllers;

[ApiController]
[Route("api/v2")]
public class WorkshopController : ControllerBase
{
    private static readonly object Gate = new();
    private static readonly string FilePath = Path.Combine(AppContext.BaseDirectory, "workshop-data.json");
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };

    private static WorkshopData Load()
    {
        lock (Gate)
        {
            if (!System.IO.File.Exists(FilePath))
            {
                var seed = Seed();
                Save(seed);
                return seed;
            }
            var data=JsonSerializer.Deserialize<WorkshopData>(System.IO.File.ReadAllText(FilePath), JsonOptions) ?? Seed();
            EnsureServiceCatalog(data);
            foreach(var invoice in data.Invoices)Calculate(invoice);
            return data;
        }
    }

    private static void Save(WorkshopData data)
    {
        lock (Gate) { System.IO.File.WriteAllText(FilePath, JsonSerializer.Serialize(data, JsonOptions)); }
    }

    [HttpGet("overview")]
    public IActionResult Overview()
    {
        var d = Load();
        return Ok(new
        {
            d.Customers, d.Cars, d.Services,
            invoices = d.Invoices.OrderByDescending(x => x.Id),
            d.Transactions,
            d.Settings,
            vehicleCatalog = VehicleCatalog,
            serviceCatalog = ServiceCatalog,
            paid = d.Invoices.Sum(x => x.Paid),
            outstanding = d.Invoices.Sum(x => Math.Max(0, x.Total - x.Paid)),
            invoiceCount = d.Invoices.Count,
            customerCount = d.Customers.Count,
            carCount = d.Cars.Count
        });
    }

    [HttpGet("customers")]
    public IActionResult Customers() => Ok(Load().Customers);

    [HttpPost("customers")]
    public IActionResult CreateCustomer(CustomerRecord customer)
    {
        var d = Load(); customer.Id = Next(d.Customers.Select(x => x.Id)); d.Customers.Add(customer); Save(d); return Ok(customer);
    }

    [HttpPut("customers/{id:int}")]
    public IActionResult UpdateCustomer(int id, CustomerRecord customer)
    {
        var d = Load(); var i = d.Customers.FindIndex(x => x.Id == id); if (i < 0) return NotFound(); customer.Id=id; d.Customers[i]=customer; Save(d); return Ok(customer);
    }

    [HttpDelete("customers/{id:int}")]
    public IActionResult DeleteCustomer(int id)
    {
        var d=Load(); if(d.Customers.RemoveAll(x=>x.Id==id)==0)return NotFound();Save(d);return NoContent();
    }

    [HttpGet("cars")]
    public IActionResult Cars() => Ok(Load().Cars);

    [HttpPost("cars")]
    public IActionResult CreateCar(CarRecord car)
    {
        var d=Load(); car.Id=Next(d.Cars.Select(x=>x.Id)); d.Cars.Add(car); Save(d); return Ok(car);
    }

    [HttpPut("cars/{id:int}")]
    public IActionResult UpdateCar(int id, CarRecord car)
    {
        var d=Load(); var i=d.Cars.FindIndex(x=>x.Id==id); if(i<0)return NotFound();car.Id=id;d.Cars[i]=car;Save(d);return Ok(car);
    }

    [HttpDelete("cars/{id:int}")]
    public IActionResult DeleteCar(int id)
    {
        var d=Load(); if(d.Cars.RemoveAll(x=>x.Id==id)==0)return NotFound();Save(d);return NoContent();
    }

    [HttpGet("services")]
    public IActionResult Services() => Ok(Load().Services);

    [HttpPost("services")]
    public IActionResult CreateService(ServiceRecord service)
    {
        var d=Load();service.Id=Next(d.Services.Select(x=>x.Id));d.Services.Add(service);Save(d);return Ok(service);
    }

    [HttpPut("services/{id:int}")]
    public IActionResult UpdateService(int id, ServiceRecord service)
    {
        var d=Load();var i=d.Services.FindIndex(x=>x.Id==id);if(i<0)return NotFound();service.Id=id;d.Services[i]=service;Save(d);return Ok(service);
    }

    [HttpDelete("services/{id:int}")]
    public IActionResult DeleteService(int id)
    {
        var d=Load();if(d.Services.RemoveAll(x=>x.Id==id)==0)return NotFound();Save(d);return NoContent();
    }

    [HttpGet("catalogs")]
    public IActionResult Catalogs() => Ok(new { vehicles = VehicleCatalog, services = ServiceCatalog });

    [HttpGet("invoices")]
    public IActionResult Invoices() => Ok(Load().Invoices.OrderByDescending(x => x.Id));

    [HttpPost("invoices")]
    public IActionResult CreateInvoice(InvoiceRecord invoice)
    {
        var d=Load();var numericId=d.Invoices.Count==0?1001:d.Invoices.Max(x=>x.Id)+1;invoice.Id=numericId;invoice.Number=$"{d.Settings.InvoicePrefix}-{numericId}";if(string.IsNullOrWhiteSpace(invoice.IssuedBy))invoice.IssuedBy=d.Settings.DefaultIssuedBy;Calculate(invoice);invoice.CreatedAt=DateTime.UtcNow.ToString("O");d.Invoices.Add(invoice);var car=d.Cars.FirstOrDefault(x=>x.Id==invoice.CarId);if(car!=null&&invoice.MileageAtService>0)car.Mileage=invoice.MileageAtService;RecordInvoiceTransaction(d,invoice);Save(d);return Ok(invoice);
    }

    [HttpPut("invoices/{id:int}")]
    public IActionResult UpdateInvoice(int id,InvoiceRecord invoice)
    {
        var d=Load();var i=d.Invoices.FindIndex(x=>x.Id==id);if(i<0)return NotFound();invoice.Id=id;invoice.Number=string.IsNullOrWhiteSpace(invoice.Number)?$"{d.Settings.InvoicePrefix}-{id}":invoice.Number;if(string.IsNullOrWhiteSpace(invoice.IssuedBy))invoice.IssuedBy=d.Settings.DefaultIssuedBy;if(string.IsNullOrWhiteSpace(invoice.CreatedAt))invoice.CreatedAt=DateTime.UtcNow.ToString("O");Calculate(invoice);d.Invoices[i]=invoice;var car=d.Cars.FirstOrDefault(x=>x.Id==invoice.CarId);if(car!=null&&invoice.MileageAtService>0)car.Mileage=invoice.MileageAtService;Save(d);return Ok(invoice);
    }

    [HttpDelete("invoices/{id:int}")]
    public IActionResult DeleteInvoice(int id)
    {
        var d=Load();var invoice=d.Invoices.FirstOrDefault(x=>x.Id==id);if(invoice==null)return NotFound();d.Invoices.RemoveAll(x=>x.Id==id);d.Transactions.RemoveAll(x=>x.InvoiceId==id);Save(d);return NoContent();
    }

    [HttpPost("invoices/{id:int}/payments")]
    public IActionResult AddPayment(int id,PaymentRequest payment)
    {
        var d=Load();var invoice=d.Invoices.FirstOrDefault(x=>x.Id==id);if(invoice==null)return NotFound();var amount=Math.Min(payment.Amount,Math.Max(0,invoice.Total-invoice.Paid));if(amount<=0)return BadRequest("الفاتورة مسددة بالكامل");        invoice.Paid+=amount;invoice.Status=invoice.Paid>=invoice.Total-0.01m?"مدفوع":"مدفوع جزئيًا";d.Transactions.Add(new TransactionRecord{Id=Next(d.Transactions.Select(x=>x.Id)),Type="إيراد",Description="تحصيل فاتورة #INV-"+id,Amount=amount,Method=payment.Method,Date=DateTime.Today.ToString("yyyy-MM-dd"),InvoiceId=id});Save(d);return Ok(invoice);

    }

    [HttpGet("transactions")]
    public IActionResult Transactions() => Ok(Load().Transactions.OrderByDescending(x=>x.Id));

    [HttpPost("transactions")]
    public IActionResult CreateTransaction(TransactionRecord transaction)
    {
        var d=Load();transaction.Id=Next(d.Transactions.Select(x=>x.Id));transaction.Date=string.IsNullOrWhiteSpace(transaction.Date)?DateTime.Today.ToString("yyyy-MM-dd"):transaction.Date;d.Transactions.Add(transaction);Save(d);return Ok(transaction);
    }

    [HttpPut("settings")]
    public IActionResult UpdateSettings(SettingsRecord settings)
    {
        var d=Load();d.Settings=settings;Save(d);return Ok(settings);
    }

    private static void Calculate(InvoiceRecord invoice)
    {
        invoice.Subtotal=invoice.Items.Sum(x=>x.Quantity*x.UnitPrice);invoice.DiscountAmount=invoice.Subtotal*invoice.DiscountPercent/100m;var afterDiscount=invoice.Subtotal-invoice.DiscountAmount;invoice.TaxAmount=afterDiscount*invoice.TaxPercent/100m;invoice.Total=afterDiscount+invoice.TaxAmount;
        invoice.Paid=Math.Clamp(invoice.Paid,0,invoice.Total);invoice.Status=invoice.Paid<=0?"معلق":invoice.Paid>=invoice.Total-0.01m?"مدفوع":"مدفوع جزئيًا";
    }

    private static void RecordInvoiceTransaction(WorkshopData d,InvoiceRecord invoice)
    {
        if(invoice.Paid>0)d.Transactions.Add(new TransactionRecord{Id=Next(d.Transactions.Select(x=>x.Id)),Type="إيراد",Description="فاتورة #INV-"+invoice.Id,Amount=invoice.Paid,Method=invoice.PaymentMethod,Date=invoice.Date,InvoiceId=invoice.Id});
    }

    private static readonly Dictionary<string, string[]> VehicleCatalog = new(StringComparer.Ordinal)
    {
        ["تويوتا"]=["كورولا","يارس","كامري","افالون","هايلكس","فورتشنر","رافع 4","سي إتش آر","بريفيا","كراون","لاندر كروزر","هايس"],
        ["هيونداي"]=["إتش1","إلينترا","سوناتا","توسان","أكسنت","كريتا","كونا","بيتونى","سانتا فاي","ستارجيزر","فينو","إيونك"],
        ["كيا"]=["سبورتاج","سيراتو","ريو","كادينزا","سورينتو","سيلتوس","كارنفال","بيكانتو","اكسيد","كوريس","K5","K8"],
        ["نيسان"]=["صني","سنترا","كيكس","قاشقاي","باترول","اكستيرا","تيتان","نافارا","ميكرا","ليف","أرمادا","إكس تريل"],
        ["ميتسوبيشي"]=["لانسر","إكليبس كروس","أتراج","اوتلاندر","مونتيرو","باجيرو","إكس باندر","ميرانزا","إل 200","سبايس ستار"],
        ["شيفروليه"]=["أوبترا","افيو","كروز","ماليبو","إمبالا","تراكس","كابتيفا","تاهو","كولورادو","سبارك","لوجان"],
        ["بي واي دي"]=["F3","L3","إف3 أر","فينغ","تانج","سواي","سونج بلس","هان","سول 3","أتل 3","دولفين","سيجل"],
        ["مرسيدس-بنز"]=["A-Class","C-Class","E-Class","S-Class","GLA","GLC","GLE","GLS","G-Class","CLA","V-Class","Sprinter"],
        ["بي إم دبليو"]=["الفئة الأولى","الفئة الثالثة","الفئة الخامسة","الفئة السابعة","X1","X3","X5","X6","X7","iX","i4","i5"],
        ["أودي"]=["A3","A4","A5","A6","A7","A8","Q2","Q3","Q5","Q7","Q8","e-tron"],
        ["فولكس فاجن"]=["بولو","جيتا","تيجوان","طوارق","باسات","تي روك","جولف","آرتيون","ترانسفورتر","ID.4","ID.6","فوسات"],
        ["سيتروين"]=["C3","C4","C5","C-Elysee","C4 X","C5 Aircross","بيرلينجو","سباس تورير","Jumpy","ديسباتش"],
        ["بيجو"]=["208","2008","301","308","408","508","3008","5008","بارتنر","ريفتر","إكسبرت"],
        ["رينو"]=["لوجان","سانديرو","ميجان","كابتور","داستر","أركانا","تاليانت","تليفيو","كولييوس","كادجار"],
        ["سوبارو"]=["إمبريزا","فورستر","اوتباك","XV","أسنت","BRZ","كروستريك","ليجاسي"],
        ["ماهندرا"]=["سكوربيو","XUV300","XUV700","بوليرو","ثار","مارازو","XUV500","كيب"]
    };

    private static readonly Dictionary<string, string[]> ServiceCatalog = new(StringComparer.Ordinal)
    {
        ["الصيانة الدورية"]=["تغيير زيت المحرك","تغيير فلتر الزيت","تغيير فلتر الهواء","تغيير فلتر المقصورة","فحص شامل دوري","تصفية السيارة","تغيير زيت ناقل الحركة","تغيير سائل التبريد","تغيير فلتر الوقود"],
        ["المحرك"]=["فحص المحرك بالكمبيوتر","كشف أعطال المحرك","تغيير شمعات الإشعال","تنظيف البخاخات","فحص طرمبة الوقود","تغيير طرمبة الوقود","تغيير جوان وكوتشة","تغيير سير التوقيت","تغيير ماء الردياتير","تغيير طرمبة المياة","تنظيف غرفة المحرك","تركيب غطاء المحرك","تغيير بلف الحرارة","تعديل حساس الأكسيجين"],
        ["الفرامل"]=["فحص الفرامل","تغيير تيل فرامل أمامي","تغيير تيل فرامل خلفي","تغيير ديسك فرامل","تغيير طبق فرامل","تغيير زيت الفرامل","تغيير طقم فرامل","فحص الهاند بريك","تعديل الهاند بريك","فحص ABS","تغيير سوست الفرامل"],
        ["ناقل الحركة"]=["فحص وصيانة الجير الأوتوماتيك","تغيير زيت الجير الأوتوماتيك","برمجة الكونترول الجير","تغيير كوبلنات","تغيير دبل كلاش","تغيير طقم دبرياج","تغيير كم كوبلن","فحص ناقل الحركة اليدوي","تغيير بلف دبرياج"],
        ["العجلات والإطارات"]=["تغيير إطار","ترصيص عجلات","ضبط زوايا العجل","فحص بيل فرامل العجل","تغيير سابلر","تغيير مقصات","تغيير رولمان المقصات","تغيير فرامل عكس","تعديل زاوية الكاستور","تبديل جنط","ترقيع إطار","فحص ضغط الإطارات"],
        ["التعليق والمقصات"]=["تغيير مساعدات أمامية","تغيير مساعدات خلفية","تغيير أكال","تغيير مقصات","تغيير رولمانات المقصات","تغيير جنزير المقصات","تغيير طبة مساعدين","فحص نيشير مقصات","تغيير سوست المساعدات","فحص شنكلات"],
        ["الكهرباء والإلكترونيات"]=["تشخيص أعطال بالكمبيوتر","فحص الدينامو","تغيير دينامو","فحص الشحن","تغيير بطارية","تغيير حساس حرارة","تغيير حساس سرعة","تغيير حساس بوزيشن","فحص أسلاك السيارات","إصلاح أسلاك كهرباء","برمجة مفاتيح","تغيير أوبتيكال","فحص الإضاءة","تركيب كشافات"],
        ["التكييف والتدفئة"]=["فحص التكييف","تعبئة فريون","كشف تسريب فريون","تغيير كباس التكييف","تغيير كمبروسر","تغيير رديتر مكيف","تنظيف مكيف","فحص دارة التكييف","تغيير حساس مكيف","تغيير طرمبة مياه التكييف","تعقيم المكيف"],
        ["الهيكل والدهان"]=["تقييم هبوط سيارة","سمكرة باب","سمكرة سقف","دهان باب","دهان صدام","معالجة صدا","إصلاح صدام بلاستيك","تركيب واقي صدام","تنظيف داخلي","تفصيل سقف","تلميع نانو سيراميك","غسيل بالبخار","تعديل شعرات الصاج"],
        ["الزجاج والمرايات"]=["تغيير زجاج أمامي","تغيير زجاج خلفي","تغيير زجاج جانبي","تغيير موتور زجاج","تغيير سكينة زجاج","تغيير مراية جانبية","تعديل مراية كهربائية","تغيير ماتور مراية","إصلاح استيكر زجاج","إضافة عازل حراري"],
        ["المقصورة والجلود"]=["تنظيف وتلميع تابلوه","تغيير جلد مقاعد","إصلاح جلد مقعد","تغيير فرش أرضية","تغيير دواسة فرامل","تغيير دواسة بنزين","إصلاح قفل باب","تغيير ريمان قير","تنظيف الستائر","تركيب شبك حديدي"],
        ["العادم والدخان"]=["تغيير شكمان","تغيير لواكر عادم","تغيير كاتاليزر","لحام شلنجير","فحص استهلاك زيت","تغيير مرشحات الكربون","فحص دخان عادم","تركيب فلتر عادم"],
        ["الفحص والضمان"]=["فحص ما قبل الشراء","فحص ودروع الفحص الفني","اختبار مسار القيادة","فحص تاريخ المركبة","تقرير فني مكتوب","فحص ضمان خدمة","تسليم اختبار الطريق","تجهيز تقرير تأمين"]
    };

    private static void EnsureServiceCatalog(WorkshopData data)
    {
        var next=Next(data.Services.Select(x=>x.Id));
        var changed=false;
        foreach(var category in ServiceCatalog)
        foreach(var name in category.Value)
        {
            if(data.Services.Any(x=>x.Name.Equals(name,StringComparison.OrdinalIgnoreCase)))continue;
            data.Services.Add(new ServiceRecord{Id=next++,Name=name,Category=category.Key,Price=350,Cost=120,TaxPercent=data.Settings.TaxPercent>0?data.Settings.TaxPercent:14});changed=true;
        }
        if(changed)Save(data);
    }

    private static int Next(IEnumerable<int> ids) { var list=ids.ToList();return list.Count==0?1:list.Max()+1; }

    private static WorkshopData Seed()
    {
        return new WorkshopData
        {
            Customers=[new(){Id=1,Name="أحمد محمد",Phone="01012345678",Email="ahmed@email.com",Address="القاهرة",TaxNumber=""},new(){Id=2,Name="سارة علي",Phone="01123456789",Email="sara@email.com",Address="الجيزة",TaxNumber=""}],
            Cars=[new(){Id=1,CustomerId=1,Plate="أ ب ج 1234",Brand="تويوتا",Model="كورولا",Year=2022,Vin="JTDBR32E",Mileage=45000},new(){Id=2,CustomerId=2,Plate="د هـ و 5678",Brand="هيونداي",Model="النترا",Year=2021,Vin="KMH",Mileage=62000}],
            Services=[new(){Id=1,Name="تغيير زيت وفلاتر",Category="الصيانة الدورية",Price=450,Cost=180,TaxPercent=14},new(){Id=2,Name="فحص الفرامل",Category="الفرامل",Price=350,Cost=120,TaxPercent=14},new(){Id=3,Name="ضبط زوايا",Category="العجلات",Price=650,Cost=250,TaxPercent=14}],
            Invoices=[new(){Id=1001,Number="INV-1001",CustomerId=1,CarId=1,Date="2026-11-21",DueDate="2026-11-28",Status="مدفوع",PaymentMethod="كاش",DiscountPercent=5,TaxPercent=14,Paid=866.40m,Notes="تم تغيير الزيت والفلاتر",Items=[new(){ServiceId=1,Name="تغيير زيت وفلاتر",Quantity=1,UnitPrice=450,Cost=180},new(){ServiceId=2,Name="فحص الفرامل",Quantity=1,UnitPrice=350,Cost=120}]}],
            Transactions=[new(){Id=1,Type="إيراد",Description="فاتورة #INV-1001",Amount=1741.05m,Method="كاش",Date="2026-11-21",InvoiceId=1001}],
            Settings=new(){WorkshopName="مركز DRIVE للصيانة",Phone="01000000000",Address="القاهرة الجديدة",TaxNumber="",CommercialRegister="",Email="info@drive-eg.com",InvoiceFooter="شكرًا لتعاملكم معنا",DefaultIssuedBy="عبدالله أحمد",TaxPercent=14,InvoicePrefix="INV",LowStockAlert=true}
        };
    }
}

public class WorkshopData
{
 public List<CustomerRecord> Customers{get;set;}=[];public List<CarRecord> Cars{get;set;}=[];public List<ServiceRecord> Services{get;set;}=[];public List<InvoiceRecord> Invoices{get;set;}=[];public List<TransactionRecord> Transactions{get;set;}=[];public SettingsRecord Settings{get;set;}=new();
}
public class CustomerRecord{public int Id{get;set;}public string Name{get;set;}="";public string Phone{get;set;}="";public string Email{get;set;}="";public string Address{get;set;}="";public string TaxNumber{get;set;}="";public decimal Balance{get;set;}}
public class CarRecord{public int Id{get;set;}public int CustomerId{get;set;}public string Plate{get;set;}="";public string Brand{get;set;}="";public string Model{get;set;}="";public int Year{get;set;}public string Vin{get;set;}="";public int Mileage{get;set;}}
public class ServiceRecord{public int Id{get;set;}public string Name{get;set;}="";public string Category{get;set;}="";public decimal Price{get;set;}public decimal Cost{get;set;}public decimal TaxPercent{get;set;}}
public class InvoiceRecord{public int Id{get;set;}public string Number{get;set;}="";public int CustomerId{get;set;}public int CarId{get;set;}public string Date{get;set;}="";public string DueDate{get;set;}="";public string Status{get;set;}="معلق";public string PaymentMethod{get;set;}="كاش";public decimal DiscountPercent{get;set;}public decimal TaxPercent{get;set;}public decimal Subtotal{get;set;}public decimal DiscountAmount{get;set;}public decimal TaxAmount{get;set;}public decimal Total{get;set;}public decimal Paid{get;set;}public string Notes{get;set;}="";public string WarrantyNotes{get;set;}="";public string IssuedBy{get;set;}="";public string CreatedAt{get;set;}="";public int MileageAtService{get;set;}public List<InvoiceItem> Items{get;set;}=[];}
public class InvoiceItem{public int ServiceId{get;set;}public string Name{get;set;}="";public decimal Quantity{get;set;}=1;public decimal UnitPrice{get;set;}public decimal Cost{get;set;}}
public class TransactionRecord{public int Id{get;set;}public string Type{get;set;}="إيراد";public string Description{get;set;}="";public decimal Amount{get;set;}public string Method{get;set;}="كاش";public string Date{get;set;}="";public int InvoiceId{get;set;}}
public class PaymentRequest{public decimal Amount{get;set;}public string Method{get;set;}="كاش";}
public class SettingsRecord{public string WorkshopName{get;set;}="مركز الصيانة";public string Phone{get;set;}="";public string Address{get;set;}="";public string TaxNumber{get;set;}="";public string CommercialRegister{get;set;}="";public string Email{get;set;}="";public string InvoiceFooter{get;set;}="شكرًا لتعاملكم معنا";public string DefaultIssuedBy{get;set;}="عبدالله أحمد";public decimal TaxPercent{get;set;}=14;public string InvoicePrefix{get;set;}="INV";public bool LowStockAlert{get;set;}=true;}
