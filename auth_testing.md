# CollabSphere Auth Testing

## Credentials
- admin@collabsphere.com / admin123
- atanu@collabsphere.com / password123 (and rahul, priya, arjun @collabsphere.com / password123)

## API test
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"atanu@collabsphere.com","password":"password123"}'
curl -b cookies.txt http://localhost:8001/api/auth/me
```
Login returns `{user, token}` and sets an httpOnly `access_token` cookie. `/me` returns the same user via cookie or `Authorization: Bearer <token>`.

## Notes
- WebSocket auth: `/api/ws?token=<jwt from login body>` (httpOnly cookie also accepted on same-origin).
- Authorization is enforced server-side on every workspace/channel/message operation.
