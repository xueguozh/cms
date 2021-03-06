if (window.top != self) {
  window.top.location = self.location;
}

var $url = '/index';
var $urlCreate = '/index/actions/create';
var $urlDownload = '/index/actions/download';
var $packageIdApp = 'SS.CMS.App';
var $idSite = 'site';

var data = utils.initData({
  siteId: utils.getQueryInt('siteId'),
  sessionId: localStorage.getItem('sessionId'),
  defaultPageUrl: null,
  isNightly: null,
  version: null,
  targetFramework: null,
  adminLogoUrl: null,
  adminTitle: null,
  isSuperAdmin: null,
  packageList: null,
  packageIds: null,
  menus: [],
  siteUrl: null,
  previewUrl: null,
  local: null,

  menu: null,
  activeParentMenu: null,
  activeChildMenu: null,

  newVersion: null,
  updatePackages: 0,
  pendingCount: 0,
  lastExecuteTime: new Date(),
  timeoutId: null,

  winHeight: 0,
  winWidth: 0,
  isDesktop: true,
  isMobileMenu: false
});

var methods = {
  openPageCreateStatus() {
    utils.openLayer({
      title: '生成进度查看',
      url: utils.getCmsUrl('createStatus', {siteId: this.siteId}),
      full: true
    });
    return false;
  },

  apiGet: function () {
    var $this = this;

    $api.get($url, {
      params: {
        siteId: this.siteId,
        sessionId: this.sessionId
      }
    }).then(function (response) {
      var res = response.data;
      if (res.value) {
        $this.defaultPageUrl = res.defaultPageUrl;
        $this.isNightly = res.isNightly;
        $this.version = res.version;
        $this.targetFramework = res.targetFramework;
        $this.adminLogoUrl = res.adminLogoUrl || utils.getAssetsUrl('images/logo.png');
        $this.adminTitle = res.adminTitle || 'SS CMS';
        $this.isSuperAdmin = res.isSuperAdmin;
        $this.packageList = res.packageList;
        $this.packageIds = res.packageIds;
        $this.menus = res.menus;
        $this.siteName = res.siteName;
        $this.siteUrl = res.siteUrl;
        $this.previewUrl = res.previewUrl;
        $this.local = res.local;
        $this.menu = $this.menus[0];
        $this.activeParentMenu = $this.menus[0].children[0];

        document.title = $this.adminTitle;

        setTimeout($this.ready, 100);
      } else {
        location.href = res.redirectUrl;
      }
    }).catch(function (error) {
      if (error.response && error.response.status === 400) {
        utils.error($this, error, {redirect: true});
      } else if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        location.href = utils.getRootUrl('login');
      } else if (error.response && error.response.status === 500) {
        utils.error($this, error);
      }
    });
  },

  apiCache: function() {
    var $this = this;

    $api.post($url + '/actions/cache', {
      siteId: this.siteId
    }).then(function (response) {
      var res = response.data;
      
    }).catch(function (error) {
      utils.error($this, error);
    }).then(function () {
      $this.create();
    });
  },

  ready: function () {
    var $this = this;

    window.onresize = $this.winResize;
    window.onresize();

    $this.apiCache();

    if ($this.isSuperAdmin) {
      $this.getUpdates();
    }

    setInterval(function () {
      var dif = new Date().getTime() - $this.lastExecuteTime.getTime();
      var minutes = dif / 1000 / 60;
      if (minutes > 2) {
        $this.create();
      }
    }, 60000);

    utils.loading($this, false);
  },

  getUpdates: function () {
    var $this = this;

    $apiCloud.get('updates', {
      params: {
        isNightly: $this.isNightly,
        version: $this.version,
        targetFramework: $this.targetFramework,
        packageIds: $this.packageIds.join(',')
      }
    }).then(function (response) {
      var releases = response.data;
      for (var i = 0; i < releases.length; i++) {
        var release = releases[i];
        if (!release || !release.version) continue;
        if (release.pluginId == $packageIdApp) {
          $this.downloadSsCms(release);
        } else {
          var installedPackages = $.grep($this.packageList, function (e) {
            return e.id == release.pluginId;
          });
          if (installedPackages.length == 1) {
            var installedPackage = installedPackages[0];
            if (installedPackage.version) {
              if (utils.compareVersion(installedPackage.version, release.version) == -1) {
                $this.updatePackages++;
              }
            } else {
              $this.updatePackages++;
            }
          }
        }
      }
    });
  },

  downloadSsCms: function (release) {
    var $this = this;
    if (utils.compareVersion($this.version, release.version) != -1) return;
    var major = release.version.split('.')[0];
    var minor = release.version.split('.')[1];

    $api.post($urlDownload, {
      packageId: $packageIdApp,
      version: release.version
    }).then(function (response) {
      var res = response.data;

      if (res.value) {
        $this.newVersion = {
          updatesUrl: 'https://www.siteserver.cn/updates/v' + major + '_' + minor + '/index.html',
          version: release.version,
          published: release.published,
          releaseNotes: release.releaseNotes
        };
      }
    });
  },

  create: function () {
    var $this = this;
    
    $this.lastExecuteTime = new Date();
    clearTimeout($this.timeoutId);
    $api.post($urlCreate, {
      sessionId: this.sessionId
    }).then(function (response) {
      var res = response.data;

      $this.pendingCount = res.value;
      if ($this.pendingCount === 0) {
        $this.timeoutId = setTimeout($this.create, 10000);
      } else {
        $this.timeoutId = setTimeout($this.create, 100);
      }
    }).catch(function (error) {
      if (error.response && error.response.status === 401) {
        location.href = utils.getRootUrl('login');
      }
      $this.timeoutId = setTimeout($this.create, 1000);
    });
  },

  winResize: function () {
    this.winHeight = $(window).height();
    this.winWidth = $(window).width();
    this.isDesktop = this.winWidth > 992;
  },

  getHref: function (menu) {
    var link = menu.target != '_layer' ? menu.link : '';
    return link || "javascript:;";
  },

  getTarget: function (menu) {
    return menu.target ? menu.target : "right";
  },

  btnTopMenuClick: function (menu) {
    if (menu.children) {
      for(var i = 0; i < menu.children.length; i++) {
        var child = menu.children[i];
        if (child.children) {
          this.activeParentMenu = child;
          break;
        }
      }
    }
    this.menu = menu;
  },

  btnLeftMenuClick: function (menu, e) {
    if (menu.children) {
      this.activeParentMenu = this.activeParentMenu === menu ? null : menu;
    } else {
      this.activeChildMenu = menu;
      this.isMobileMenu = false;
      if (menu.target == '_layer') {
        e.stopPropagation();
        e.preventDefault();
        utils.openLayer({
          title: menu.text,
          url: menu.link,
          full: true
        });
      }
    }
  },

  btnMobileMenuClick: function () {
    this.isMobileMenu = !this.isMobileMenu;
  }
};

var $vue = new Vue({
  el: "#main",
  data: data,
  methods: methods,
  created: function () {
    this.apiGet();
  },
  computed: {
    leftMenuWidth: function () {
      if (this.isDesktop) return '200px';
      return this.isMobileMenu ? '100%' : '200px'
    }
  }
});