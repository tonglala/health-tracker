import http.server
import socketserver
import socket
import os
import webbrowser

PORT = 8000

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

Handler = http.server.SimpleHTTPRequestHandler

# Change to the script's directory (DietTracker)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

ip_address = get_ip()
url = f"http://{ip_address}:{PORT}"

print("="*60)
print(f"  好孕紀錄 (健康管理) 伺服器已啟動")
print("="*60)
print(f"  請確保手機連接到同一個 WiFi")
print(f"  然後在手機瀏覽器輸入以下網址：")
print(f"\n  {url}\n")
print("="*60)
print("  (請不要關閉這個視窗，直到妳使用完畢)")

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        # Open browser on computer too for convenience
        webbrowser.open(f"http://localhost:{PORT}")
        httpd.serve_forever()
except OSError as e:
    if e.errno == 10048:
        print(f"錯誤: Port {PORT} 已經被佔用。請關閉其他使用此 Port 的程式後重試。")
    else:
        print(f"發生錯誤: {e}")
input()
