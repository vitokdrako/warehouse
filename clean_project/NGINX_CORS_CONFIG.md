# NGINX CORS Configuration для backrentalhub.farforrent.com.ua
# Додайте цей блок до вашого nginx.conf або site config

# Всередині server block для backrentalhub.farforrent.com.ua:

location /uploads/ {
    # CORS headers для зображень
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept' always;
    
    # Кешування
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    # Якщо OPTIONS запит - повертаємо 204
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        add_header 'Access-Control-Max-Age' 86400;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }
    
    try_files $uri $uri/ =404;
}

location /image/ {
    # CORS headers для OpenCart cache images
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    
    # Кешування
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        add_header 'Access-Control-Max-Age' 86400;
        return 204;
    }
    
    try_files $uri $uri/ =404;
}

# Альтернативно - глобальний CORS для всіх статичних файлів:
location ~* \.(jpg|jpeg|png|gif|ico|webp|svg)$ {
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
