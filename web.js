//express
var express = require('express');
var hbs = require('hbs');
var bodyParser = require('body-parser');
//blockchain
var hfc = require('hfc');
var util = require('util');
var fs=require('fs');
//database
var mysql=require('mysql');

var insertSql,deleteSql,selectSql;
//用户，管理员，目标用户
var client,admin,goal;
//证书
var usrCert, goalCert,adminCert;
// constants
var IP="";
var registrar = {
    name: 'WebAppAdmin',
    secret: 'DJY27pEnl16d'
};
var chaincodeId={name:"mycc"};
//database connect
var conn=mysql.createConnection({
  host:'',
  user:'',
  password:'',
  port:'',
  database:''
});
//  Create and configure a test chain
var chain = hfc.newChain("testChain");

var app=express();
// 添加 body-parser 中间件
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
//框架设置
app.use(express.static(__dirname + '/Public'));
app.set("views", __dirname + "/View");
// 指定模板文件的后缀名为html
app.set("view engine", "html");
// 运行hbs模块
app.engine('html', hbs.__express);

//主体
conn.connect(function(err){
    if(err){
        console.log('[query]-:'+err);
        return;
    }
    console.log('connection succeed.');
});

init();
app.get('/homepage', function(req, res) {
    sql("select",function(userData){
        res.render('index',{userData:userData});
    });
});
app.post('/assign',function (req, res) {
    //得到POST数据
    var Data = req.body;
    handleUserRequests(Data.uName,Data.fcn,function(ret){
        if(!ret){
            res.render('index',{result:true});
        }else{
            res.render('index',{result:false});
            sql("insert",function(message){
              console.log(message);
            },Data.uName,Data.id,Data.pwd,Data.contact);
          }
        });
    });
app.post('/transfer',function (req, res) {
    //得到POST数据
    var Data = req.body;
    handleUserRequests(Data.uName,Data.fcn,function(ret){
        if(!ret){
            res.render('index',{result:true});
        }else{
            res.render('index',{result:false});
          }
    },Data.gName,Data.amount);
});
app.post('/getBalence',function (req, res) {
    //得到POST数据
    var Data = req.body;
    handleUserRequests(Data.uName,Data.fcn,function(ret){
        if(ret==undefined){
            res.render('index',{result:false});
        }else{
            res.render('index',{result:true});
            res.render('index',{data:ret});
          }
    });
});
app.post('/delete', function(req, res) {
    //得到POST数据
    var Data = req.body;
    sql("delete",function(ret){
        if(ret!=0){
          res.render('index',{result:true});
        }
    },Data.uName);
    res.redirect('/homepage');
});
app.listen(8080);

/*
conn.end(function(err){
    if(err){
        console.log('[query]-:'+err);
        return;
    }
    console.log('end succeed.');
});
*/


/*********************************************函数*******************************************/
function init(){
  //connect blockchain
  chain.setKeyValStore(hfc.newFileKeyValStore(__dirname+'/tmp/keyValStore'));
  chain.setMemberServicesUrl("grpc://"+IP+":50051");
  chain.addPeer("grpc://"+IP+":30303");
  chain.setDevMode(true);
  // Enroll "WebAppAdmin" which is already registered because it is
  // listed in fabric/membersrvc/membersrvc.yaml with its one time password.
  // If "WebAppAdmin" has already been registered, this will still succeed
  // because it stores the state in the KeyValStore
  chain.enroll(registrar.name, registrar.secret, function(err, webAppAdmin) {
     if (err) return console.log("ERROR: failed to register %s: %s",registrar.name,err);
     // Successfully enrolled WebAppAdmin during initialization.
     // Set this user as the chain's registrar which is authorized to register other users.
     chain.setRegistrar(webAppAdmin);     
  });
}

function sql(method,callback,name,id,pwd,contact){
   switch(method){
    case 'insert':insertSql='INSERT INTO users(id,name,pwd,contact) VALUES(?,?,?,?)';
                  var insertParam=[id,name,pwd,contact];
                  conn.query(insertSql,insertParam,function(err,result){
                     if(err){
                      console.log('insert error');
                      return;
                     }
                      return callback(result);
                  });
                  break;
    case 'delete':deleteSql='DELETE FROM users where name = ?';
                  var deleteParam=[name];
                  conn.query(deleteSql,deleteParam,function(err,result){
                     if(err){
                      console.log('delete error');
                      return;
                     }
                     return callback(result.affectedRows);
                  });
                  break;
    case 'select':selectSql='SELECT * FROM users';
                  conn.query(selectSql,function(err,users){
                     if(err) {
                         console.log('select error');
                         return;
                     }
                      return callback(users);
                  });
                  break;
   }
}

/**
 * Get the user and if not enrolled, register and enroll the user.
 */
function getUser(name, cb) {
    chain.getUser(name, function (err, user) {
        if (err) return cb(err);
        if (user.isRegistered()) return cb(null, user);
        // User is not enrolled yet, so perform both registration and enrollment
        var registrationRequest = {
            enrollmentID: name,
            affiliation: "bank_a"
        };
        user.registerAndEnroll(registrationRequest, function (err) {
            if (err) cb(err, null);
            return cb(null, user);
        });
    });
}

function handleUserRequests(usrName,fcn,callback,goalName,amount){
    //用户
    getUser(usrName, function (err, user) {
        if (err) {
            console.log('fail to get user'+err);
        }
        client=user;
        console.log(client);
        client.getUserCert(null, function (err, userCert) {
            if (err) {
                console.log('fail to get TCert'+err);
            }
            usrCert = userCert;
        });
    });
    //管理员用户
    getUser(registrar.name, function (err, user) {
        if (err) {
            console.log('fail to get user'+err);
        }
        admin=user;
        admin.getUserCert(null, function (err, userCert) {
            if (err) {
                console.log('fail to get TCert'+err);
            }
            adminCert = userCert;
        });
    });
    if(goalName!==undefined){
      //转账目标用户
      getUser(goalName, function (err, user) {
        if (err) {
            console.log('fail to get user'+err);
        }
        goal=user;
        goal.getUserCert(null, function (err, userCert) {
            if (err) {
                console.log('fail to get TCert'+err);
            }
            goalCert = userCert;
        });
      });
    }
    switch(fcn){
        case "assign":
            var invokeRequest = {
                // The chaincode ID as provided by the 'submitted' event emitted by a TransactionContext
                chaincodeID:chaincodeId.toString(),
                // Function to trigger
                fcn: fcn,
                // Parameters for the invoke function
                args: usrCert.toString(),
                userCert: adminCert,
                confidential: true,
            };
            var tx = client.invoke(invokeRequest);
            tx.on('submitted', function (results) {
                // Invoke transaction submitted successfully
                return callback(true);
            });
            tx.on('complete', function (results) {
                return callback(true);
            });
            tx.on('error', function (err) {
                return callback(false);
            });
            break;
        case "transfer":
            var invokeRequest = {
                // The chaincode ID as provided by the 'submitted' event emitted by a TransactionContext
                chaincodeID:chaincodeId.toString(),
                // Function to trigger
                fcn: fcn,
                // Parameters for the invoke function
                args: [usrCert.toString(),goalCert.toString(),amount.toString()],
                confidential: true,
                userCert: adminCert
            };

            var tx = client.invoke(invokeRequest);
            tx.on('submitted', function (results) {
                // Invoke transaction submitted successfully
                return callback(true);
            });
            tx.on('complete', function (results) {
                return callback(true);
            });
            tx.on('error', function (err) {
                return callback(false);
            });
            break;
        case "getBalence":
            var queryRequest = {
                // The chaincode ID as provided by the 'submitted' event emitted by a TransactionContext
                chaincodeID:chaincodeId.toString(),
                // Function to trigger
                fcn: fcn,
                // Existing state variable to retrieve
                args: usrCert.toString(),
                confidential: true
            };

            var tx = client.query(queryRequest);
            tx.on('complete', function (results) {
                console.log(util.format('Client identity: %s', usrCert));
                if (results.result != usrCert) {
                    console.log(name+" is not the owner of the asset");
                }
                return callback(results);
            });
            tx.on('error', function () {
                return callback(undefined);
            });
         break;
    }    
   }



