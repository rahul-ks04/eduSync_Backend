const { Router } = require("express");
const router = Router();
const pg = require("pg");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const db = new pg.Client({
  user: "nikhiltomy",
  password: "test",
  host: "localhost",
  port: 5432,
  database: "edusync",
});

db.connect();

// JWT Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Token required");
  }
  console.log("Token received:", token);
  console.log("JWT_SECRET during verification:", process.env.JWT_SECRET);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid token");
    req.user = user; // Attach user data from token to request
    next();
  });
}

router.get("/", authenticateToken, (req, res) => {
  console.log("GET /student");
  res.send("GET /student");
});
router.post("/login", async (req, res) => {
  const { regi_no, name, classno, dob, phone_number, password } = req.body;

  try {
    const result = await db.query(
      "SELECT password FROM student WHERE register_no=$1",
      [regi_no],
    );
    const user = result.rows[0];

    if (!user || user.password !== password) {
      return res.status(401).send("Invalid credentials");
    }

    const token = jwt.sign(
      {
        name: user.name,
        register_no: user.register_no,
        //assignment_no: user.assignment_no,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1y" },
    );

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});
router.get(
  "/viewAttendance/:register_no",
  authenticateToken,
  async (req, res, next) => {
    const register_no = req.params.register_no;

    try {
      const query =
        "SELECT date_of_att, hours, day FROM attendence_cs5c WHERE register_no = $1";
      const values = [register_no];

      const result = await db.query(query, values);

      const attendanceData = result.rows.map((row) => ({
        att_id: row.att_id,
        date_of_att: row.date_of_att,
        hours: row.hours,
        day: row.day,
        //status: row.is_present ? "Present" : "Absent",
      }));

      res.status(200).json(attendanceData);
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/viewAssignmentsWithMarks",
  authenticateToken,
  async (req, res, next) => {
    //const register_no = req.user.register_no; // Extracting register_no from the token

    try {
      const query = `
      SELECT
        a.assignment_no,
        a.description,
        a.marks,
        a.due_date,
        am.award_marks,
        am.total_marks
      FROM
        assignment_cs5c a
      LEFT JOIN
        assignment_marks_cs5c am
      ON
        a.assignment_no = am.assignment_no

      ORDER BY a.assignment_no;  -- Optional: Order results by assignment number
    `;
      //const values = [register_no]; // Register number to filter marks

      const result = await db.query(query /* , values*/);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/viewStudents/:classno",
  authenticateToken,
  /*checkStudent,*/
  async (req, res, next) => {
    const classno = req.params.classno;
    try {
      const query =
        "SELECT name,register_no FROM student WHERE class=$1 ORDER BY register_no";
      const result = await db.query(query, [classno]);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/viewStudentDetails/:register_no",
  authenticateToken,
  /*validateStudent,*/
  async (req, res, next) => {
    const register_no = req.params.register_no;
    try {
      const query = "SELECT * FROM student WHERE register_no=$1";
      const result = await db.query(query, [register_no]);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/viewSchedule", authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT day, hours
      FROM schedule_cs5c
      ;
    `;
    const result = await db.query(query);
    let schedule = {};
    result.rows.forEach((row) => {
      const day = row.day;
      const hours = row.hours;
      if (!schedule[day]) {
        schedule[day] = [];
      }
      schedule[day].push(hours);
    });
    res.status(200).send(schedule);
  } catch (err) {
    console.error("Error fetching schedule:", err);
    next(err);
  }
});

async function validateStudent(req, res, next) {
  const regi_no = req.body.register_no;
  const userPassword = req.body.password;

  try {
    const result = await db.query(
      "SELECT password FROM student WHERE register_no=$1",
      [regi_no],
    );
    const storedPassword = result.rows[0]?.password;

    if (!storedPassword) {
      return res.status(404).send("User not found");
    }

    if (storedPassword === userPassword) {
      next();
    } else {
      res.status(401).send("Unauthorized");
    }
  } catch (err) {
    next(err);
  }
}

async function checkStudent(req, res, next) {
  const username = req.body.name;
  const register_no = req.body.register_no;
  const stored_username = await db.query(
    "SELECT name FROM student WHERE register_no=$1",
    [register_no],
  );
  if (stored_username != username) {
    res.status(401).send("Unauthorized");
  }
  next();
}

module.exports = router;
