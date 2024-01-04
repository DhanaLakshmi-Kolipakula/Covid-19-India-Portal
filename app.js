const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;
const initializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeServer();

//Authenticate Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const hashedPassword = await bcrypt.hash(password, 10);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      hashedPassword,
      dbUser.password
    );
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
const convertState = (e) => {
  return {
    stateId: e.state_id,
    stateName: e.state_name,
    population: e.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStates = `select * from state;`;
  const result = await db.all(getAllStates);
  response.send(result.map((each) => convertState(each)));
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `select * from state where state_id='${stateId}';`;
  const res = await db.get(getState);
  response.send(convertState(res));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrict = `insert into district(district_name,state_id,cases,cured,active,deaths)
                         values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(addDistrict);
  response.send(`District Successfully Added`);
});

//API 5
const convertDistrict = (e) => {
  return {
    districtId: e.district_id,
    districtName: e.district_name,
    stateId: e.state_id,
    cases: e.cases,
    cured: e.cured,
    active: e.active,
    deaths: e.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `select * from district where district_id=${districtId};`;
    const result = await db.get(getDistrict);
    response.send(convertDistrict(result));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `delete from district where district_id=${districtId};`;
    await db.run(deleteDistrict);
    response.send(`District Removed`);
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrict = `update district 
                              set district_name='${districtName}',
                                                  state_id=${stateId},
                                                  cases=${cases},
                                                  active=${active},
                                                  deaths=${deaths}
                              where district_id=${districtId};`;
    await db.run(updateDistrict);
    response.send(`District Details Updated`);
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `select sum(cases) as totalCases,
                             sum(cured) as totalCured,
                             sum(active) as totalActive,
                             sum(deaths) as totalDeaths
                             from district where state_id=${stateId};`;
    const result = await db.get(getQuery);
    response.send(result);
  }
);
module.exports = app;
