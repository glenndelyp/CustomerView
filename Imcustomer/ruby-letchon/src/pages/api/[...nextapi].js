//wla pa nahuman   


import mysql from 'mysql2/promise';
import { parse } from 'url';
import { sign, verify } from 'jsonwebtoken';
import { authMiddleware } from '../../utils/authMiddleware';
// import { error } from 'console';

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default async function handler(req, res) {
  const { method } = req;
  const { pathname } = parse(req.url, true);


  try{
    switch (method) {
        case 'GET':
          if (pathname === '/api/check-auth') {
            return handleCheckAuth(req, res);
          } else if (pathname === '/api/login') {
            return authMiddleware(handleGetLogin)(req, res);
          } else if (pathname === '/api/signup') {
            return authMiddleware(handleGetSignup)(req, res);
          }else if (pathname === '/api/acustomer') {
            return authMiddleware(handleGetCustomers)(req, res);
          }
          break;

          case 'POST':
            if (pathname === '/api/login') {
              return handleLogIn(req, res);
            } else if (pathname === '/api/validate-pin') {
              return handleValidatePin(req, res);
            } else if (pathname === '/api/logout') {
              return handleLogout(req, res);
            }  else if (pathname === '/api/acustomer') {
              return authMiddleware(handleAddCustomer)(req, res);
            }
             else if (pathname === '/api/orders') {
            return handleGetOrders(req, res); // Get orders
          }
            break;

        
          case 'PUT':
              if (pathname.startsWith('/api/aproduct/')) {
                const id = pathname.split('/').pop();
                await handleUpdateProduct(req, res, id);
              } else if (pathname.startsWith('/api/acustomer/')) {
                const customerId = pathname.split('/').pop();
                await handleUpdateCustomer(req, res, customerId);
              } else if (pathname === '/api/orders') {
                return handleAddOrder(req, res); // Add order
              }
              break;


              case 'DELETE':
                if (pathname.startsWith('/api/aproduct/')) {
                  const id = pathname.split('/').pop();
                  await handleDeleteProduct(req, res, id);
              }else if (pathname.startsWith('/api/acustomer/')) {
                const customerId = pathname.split('/').pop();
                await handleDeleteCustomer(req, res, customerId);
              } 
              break;

              default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`); 
  }
} catch (error) {
  console.error(error);
  res.status(500).json({ error: 'An error occurred while processing your request' });
}
}

//Authentication
function handleCheckAuth(req, res) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(200).json({ isAuthenticated: false });
  }

  try {
    verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ isAuthenticated: true });
  } catch (error) {
    return res.status(200).json({ isAuthenticated: false });
  }
}

//login
async function handleLogIn(req, res){
const { username, password } = req.body;
const [result] = await db.query('Select * FROM acustomer WHERE username = ? AND password = ?' , [username, password]);

if (result.length === 0 ){
  return res.status(401).json({error : 'Invalid username or password' });

}

  const user = result[0];
  const token = sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h'});
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=3600; SameSite=Strict`);
  res.status(200).json({ success: true, message: 'Signin successful', username: user.username });

}


//Logout

function handleLogout(req, res) {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
  res.status(200).json({ success: true, message: 'Logout successful' });
}

// Customers


async function handleAddOrder(req, res) {
  const { customerName, customerAddress, customerPhone, total, items, status, date } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO orders (customer_name, customer_address, customer_phone, total, status, date) VALUES (?, ?, ?, ?, ?, ?)',
      [customerName, customerAddress, customerPhone, total, status, date]
    );

    // Save order items in a separate table (order_items)
    for (const item of items) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [result.insertId, item.id, item.quantity, item.price]
      );
    }

    res.status(201).json({ success: true, orderId: result.insertId });
  } catch (error) {
    console.error("Error adding order:", error);
    res.status(500).json({ error: 'An error occurred while saving the order' });
  }
}

async function handleGetOrders(req, res) {
  try {
    const [orders] = await db.query('SELECT * FROM orders');
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: 'An error occurred while fetching orders' });
  }
}
