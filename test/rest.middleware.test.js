describe('loopback.rest', function() {
  var MyModel;
  beforeEach(function() {
    var ds = app.dataSource('db', { connector: loopback.Memory });
    MyModel = ds.createModel('MyModel', {name: String});
  });

  it('works out-of-the-box', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    request(app).get('/mymodels')
      .expect(200)
      .end(done);
  });

  it('should report 404 for GET /:id not found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    request(app).get('/mymodels/1')
      .expect(404)
      .end(done);
  });

  it('should report 404 for HEAD /:id not found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    request(app).head('/mymodels/1')
      .expect(404)
      .end(done);
  });

  it('should report 200 for GET /:id/exists not found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    request(app).get('/mymodels/1/exists')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        expect(res.body).to.eql({exists: false});
        done();
      });
  });

  it('should report 200 for GET /:id found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    MyModel.create({name: 'm1'}, function(err, inst) {
      request(app).get('/mymodels/' + inst.id)
        .expect(200)
        .end(done);
    });
  });

  it('should report 200 for HEAD /:id found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    MyModel.create({name: 'm2'}, function(err, inst) {
      request(app).head('/mymodels/' + inst.id)
        .expect(200)
        .end(done);
    });
  });

  it('should report 200 for GET /:id/exists found', function(done) {
    app.model(MyModel);
    app.use(loopback.rest());
    MyModel.create({name: 'm2'}, function(err, inst) {
      request(app).get('/mymodels/' + inst.id + '/exists')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          expect(res.body).to.eql({exists: true});
          done();
        });
    });
  });

  it('should honour `remoting.rest.supportedTypes`', function(done) {
    var app = loopback();

    // NOTE it is crucial to set `remoting` before creating any models
    var supportedTypes = ['json', 'application/javascript', 'text/javascript'];
    app.set('remoting', { rest: { supportedTypes: supportedTypes } });

    app.model(MyModel);
    app.use(loopback.rest());

    request(app).get('/mymodels')
      .set('Accept', 'text/html,application/xml;q=0.9,*/*;q=0.8')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200, done);
  });

  it('includes loopback.token when necessary', function(done) {
    givenUserModelWithAuth();
    app.enableAuth();
    app.use(loopback.rest());

    givenLoggedInUser(function(err, token) {
      if (err) return done(err);
      expect(token).instanceOf(app.models.accessToken);
      request(app).get('/users/' + token.userId)
        .set('Authorization', token.id)
        .expect(200)
        .end(done);
    });
  });

  it('does not include loopback.token when auth not enabled', function(done) {
    var User = givenUserModelWithAuth();
    User.getToken = function(req, cb) {
      cb(null, req.accessToken ? req.accessToken.id : null);
    };
    loopback.remoteMethod(User.getToken, {
      accepts: [{ type: 'object', http: { source: 'req' } }],
      returns: [{ type: 'object', name: 'id' }]
    });

    app.use(loopback.rest());
    givenLoggedInUser(function(err, token) {
      if (err) return done(err);
      request(app).get('/users/getToken')
        .set('Authorization', token.id)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          expect(res.body.id).to.equal(null);
          done();
        });
    });
  });

  function givenUserModelWithAuth() {
    // NOTE(bajtos) It is important to create a custom AccessToken model here,
    // in order to overwrite the entry created by previous tests in
    // the global model registry
    app.model('accessToken', {
      options: {
        base: 'AccessToken'
      },
      dataSource: 'db'
    });
    return app.model('user', {
      options: {
        base: 'User',
        relations: {
          accessTokens: {
            model: 'accessToken',
            type: 'hasMany',
            foreignKey: 'userId'
          }
        }
      },
      dataSource: 'db'
    });
  }
  function givenLoggedInUser(cb) {
    var credentials = { email: 'user@example.com', password: 'pwd' };
    var User = app.models.user;
    User.create(credentials,
      function(err, user) {
        if (err) return done(err);
        User.login(credentials, cb);
      });
  }
});
