using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace first_pro.Controllers;

[ApiController]
[Route("api")]
public class GarageController : ControllerBase
{
    private static readonly object Gate = new();
    private static readonly string DataFile = Path.Combine(AppContext.BaseDirectory, "garage-data.json");

    private static GarageData GetData()
    {
        lock (Gate)
        {
            if (!System.IO.File.Exists(DataFile))
            {
                var seed = CreateSeed();
                SaveData(seed);
                return seed;
            }

            var json = System.IO.File.ReadAllText(DataFile);
            return JsonSerializer.Deserialize<GarageData>(json, JsonOptions) ?? CreateSeed();
        }
    }

    private static void SaveData(GarageData data)
    {
        lock (Gate)
        {
            System.IO.File.WriteAllText(DataFile, JsonSerializer.Serialize(data, JsonOptions));
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        var data = GetData();
        var paid = data.Invoices.Where(x => x.Status == "مدفوع").Sum(x => x.Total);
        var pending = data.Invoices.Where(x => x.Status != "مدفوع").Sum(x => x.Total);
        return Ok(new
        {
            invoiceCount = data.Invoices.Count,
            paid,
            pending,
            customers = data.Customers.Count,
            cars = data.Cars.Count,
            invoices = data.Invoices.OrderByDescending(x => x.Id)
        });
    }

    [HttpGet("invoices")]
    public IActionResult GetInvoices() => Ok(GetData().Invoices.OrderByDescending(x => x.Id));

    [HttpPost("invoices")]
    public IActionResult CreateInvoice([FromBody] InvoiceApiModel invoice)
    {
        var data = GetData();
        var id = data.Invoices.Count == 0 ? 1001 : data.Invoices.Max(x => x.Id) + 1;
        var created = invoice with { Id = id, Date = string.IsNullOrWhiteSpace(invoice.Date) ? DateTime.Today.ToString("yyyy-MM-dd") : invoice.Date };
        data.Invoices.Add(created);
        SaveData(data);
        return Ok(created);
    }

    [HttpPut("invoices/{id:int}")]
    public IActionResult UpdateInvoice(int id, [FromBody] InvoiceApiModel invoice)
    {
        var data = GetData();
        var index = data.Invoices.FindIndex(x => x.Id == id);
        if (index < 0) return NotFound();
        data.Invoices[index] = invoice with { Id = id };
        SaveData(data);
        return Ok(data.Invoices[index]);
    }

    [HttpDelete("invoices/{id:int}")]
    public IActionResult DeleteInvoice(int id)
    {
        var data = GetData();
        var removed = data.Invoices.RemoveAll(x => x.Id == id);
        if (removed == 0) return NotFound();
        SaveData(data);
        return NoContent();
    }

    [HttpGet("customers")]
    public IActionResult GetCustomers() => Ok(GetData().Customers);

    [HttpPost("customers")]
    public IActionResult CreateCustomer([FromBody] CustomerApiModel customer)
    {
        var data = GetData();
        var created = customer with { Id = data.Customers.Count == 0 ? 1 : data.Customers.Max(x => x.Id) + 1 };
        data.Customers.Add(created);
        SaveData(data);
        return Ok(created);
    }

    [HttpGet("cars")]
    public IActionResult GetCars() => Ok(GetData().Cars);

    [HttpPost("cars")]
    public IActionResult CreateCar([FromBody] CarApiModel car)
    {
        var data = GetData();
        var created = car with { Id = data.Cars.Count == 0 ? 1 : data.Cars.Max(x => x.Id) + 1 };
        data.Cars.Add(created);
        SaveData(data);
        return Ok(created);
    }

    [HttpGet("services")]
    public IActionResult GetServices() => Ok(GetData().Services);

    [HttpPost("services")]
    public IActionResult CreateService([FromBody] ServiceApiModel service)
    {
        var data = GetData();
        var created = service with { Id = data.Services.Count == 0 ? 1 : data.Services.Max(x => x.Id) + 1 };
        data.Services.Add(created);
        SaveData(data);
        return Ok(created);
    }

    private static GarageData CreateSeed()
    {
        return new GarageData
        {
            Invoices =
            [
                new(1001, "أحمد محمد", "تويوتا كورولا 2022", "تغيير فرامل وتبديل زيت المحرك", 2850, "مدفوع", "2026-11-21"),
                new(1002, "سارة علي", "هيونداي النترا 2021", "فحص دينامو وشحن بطارية", 1450, "معلق", "2026-11-20"),
                new(1003, "محمود حسن", "كيا سبورتاج 2023", "تغيير تواير أمامية وضبط زوايا", 6200, "مدفوع", "2026-11-19")
            ],
            Customers =
            [
                new(1, "أحمد محمد", "01012345678", "القاهرة"),
                new(2, "سارة علي", "01123456789", "الجيزة"),
                new(3, "محمود حسن", "01234567890", "مدينة نصر")
            ],
            Cars =
            [
                new(1, "أحمد محمد", "تويوتا كورولا 2022", "أ ب ج 1234"),
                new(2, "سارة علي", "هيونداي النترا 2021", "د هـ و 5678"),
                new(3, "محمود حسن", "كيا سبورتاج 2023", "س ص ع 9012")
            ],
            Services =
            [
                new(1, "تغيير زيت وفلاتر", 450),
                new(2, "فحص الفرامل", 350),
                new(3, "ضبط زوايا", 650),
                new(4, "فحص شامل", 1200)
            ]
        };
    }
}

public class GarageData
{
    public List<InvoiceApiModel> Invoices { get; set; } = [];
    public List<CustomerApiModel> Customers { get; set; } = [];
    public List<CarApiModel> Cars { get; set; } = [];
    public List<ServiceApiModel> Services { get; set; } = [];
}

public record InvoiceApiModel(int Id, string Customer, string Car, string Service, decimal Total, string Status, string Date);
public record CustomerApiModel(int Id, string Name, string Phone, string Area);
public record CarApiModel(int Id, string Owner, string Model, string Plate);
public record ServiceApiModel(int Id, string Name, decimal Price);
