import json, sys, warnings
warnings.filterwarnings('ignore')

def out(data):
    print(json.dumps(data))
    sys.exit(0)

def fail(msg):
    print(json.dumps({"error": str(msg)}))
    sys.exit(1)

# ── Try sync API (older pymobiledevice3 style) ────────────────────────────────
def try_sync():
    from pymobiledevice3.lockdown import create_using_usbmux
    ld = create_using_usbmux()
    info = ld.all_values
    return ld, info

# ── Try async API (pymobiledevice3 v9+) ──────────────────────────────────────
async def try_async():
    from pymobiledevice3.lockdown import create_using_usbmux
    import inspect
    result = create_using_usbmux()
    if inspect.isawaitable(result):
        ld = await result
    else:
        ld = result
    try:
        info_result = ld.get_value()
        if inspect.isawaitable(info_result):
            info = await info_result
        else:
            info = info_result
    except Exception:
        info = ld.all_values
    return ld, info

def get_battery(ld):
    """Read battery health % from AppleSmartBattery via DiagnosticsService."""
    try:
        from pymobiledevice3.services.diagnostics import DiagnosticsService
        import inspect
        svc = DiagnosticsService(ld)
        # Try async context manager
        if hasattr(svc, '__aenter__'):
            import asyncio
            async def _read():
                async with DiagnosticsService(ld) as diag:
                    entry = diag.ioregistry_entry('AppleSmartBattery')
                    if inspect.isawaitable(entry):
                        entry = await entry
                    return entry
            io = asyncio.get_event_loop().run_until_complete(_read())
        else:
            with DiagnosticsService(ld) as diag:
                io = diag.ioregistry_entry('AppleSmartBattery')
        if not io:
            return {}
        nominal  = io.get('NominalChargeCapacity') or io.get('AppleRawMaxCapacity')
        design   = io.get('DesignCapacity')
        health_pct = round(nominal / design * 100) if nominal and design else None
        temp_raw = io.get('Temperature', 0)
        return {
            'battery_health':      health_pct,                          # max capacity %
            'battery_current':     io.get('CurrentCapacity'),           # current charge %
            'battery_cycles':      io.get('CycleCount'),
            'battery_temperature': round((temp_raw - 2731) / 10, 1) if temp_raw else None,
            'battery_voltage':     io.get('Voltage'),
            'battery_health_label': (
                'Good' if health_pct and health_pct >= 80 else
                'Fair' if health_pct and health_pct >= 60 else
                'Poor' if health_pct else 'Unknown'
            ),
        }
    except Exception:
        return {}

def build_result(info, ld=None):
    battery = get_battery(ld) if ld else {}
    return {
        'platform':          'ios',
        'manufacturer':      'Apple',
        'model':             info.get('ProductType'),
        'device_name':       info.get('DeviceName'),
        'os_version':        f"iOS {info.get('ProductVersion')}" if info.get('ProductVersion') else None,
        'serial_number':     info.get('SerialNumber'),
        'imei':              info.get('InternationalMobileEquipmentIdentity'),
        'imei2':             info.get('InternationalMobileEquipmentIdentity2'),
        'udid':              info.get('UniqueDeviceID'),
        'hardware_model':    info.get('HardwareModel'),
        'cpu_arch':          info.get('CPUArchitecture'),
        'device_color':      info.get('DeviceColor'),
        'region':            info.get('RegionInfo'),
        'phone_number':      info.get('PhoneNumber'),
        'wifi_mac':          info.get('WiFiAddress'),
        'bluetooth_mac':     info.get('BluetoothAddress'),
        'wifi_enabled':      bool(info.get('WiFiAddress')),
        'bluetooth_enabled': bool(info.get('BluetoothAddress')),
        'storage_total':     f"{round(info.get('TotalDiskCapacity', 0) / 1e9)} GB" if info.get('TotalDiskCapacity') else None,
        'storage_available': f"{round(info.get('TotalSystemAvailable', 0) / 1e9)} GB" if info.get('TotalSystemAvailable') else None,
        'activation_state':  info.get('ActivationState'),
        'icloud_status':     'clean' if info.get('ActivationState') == 'Activated' else ('locked' if info.get('ActivationState') == 'Unactivated' else 'unknown'),
        'mdm_status':        'supervised' if info.get('IsSupervised') else 'clean',
        'frp_status':        'unknown',
        **battery,
    }

# ── Try sync first ────────────────────────────────────────────────────────────
try:
    ld, info = try_sync()
    out(build_result(info, ld))
except Exception as sync_err:
    pass

# ── Try async ─────────────────────────────────────────────────────────────────
try:
    import asyncio
    async def run():
        ld, info = await try_async()
        return build_result(info, ld)
    result = asyncio.run(run())
    out(result)
except Exception as async_err:
    fail(f"sync: {sync_err} | async: {async_err}")
