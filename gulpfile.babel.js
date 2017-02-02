import gulp from 'gulp';
import uglify from 'gulp-uglify';
import cssnano from 'gulp-cssnano';
import rename from 'gulp-rename';
import concat from 'gulp-concat';
import fontmin from 'gulp-fontmin';
import nodemon from 'gulp-nodemon';
import browserify from 'browserify';
import babel from 'babelify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import childProcess from 'child_process';

let spawn = childProcess.spawn;

gulp.task('bundle', function () {
    return browserify('src/js/main.js', {
            debug: true
        }).transform(babel.configure({
            presets: ['es2015']
        })).bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('src/public'));
});

gulp.task('dev', function () {
    return browserify('src/js/main.js', {
            debug: true
        }).transform(babel.configure({
            presets: ['es2015']
        })).bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(gulp.dest('src/public'));
});

gulp.task('scripts',['dev'], function () {
    return gulp.src(['bower_components/jquery/dist/jquery.min.js',
            'bower_components/favico.js/favico-0.3.10.min.js',
            'bower_components/bootstrap/dist/js/bootstrap.min.js',
            'bower_components/Autolinker.js/dist/Autolinker.min.js',
            'bower_components/Modernizr/modernizr.custom.js',
            'bower_components/bootstrap-switch/dist/js/bootstrap-switch.min.js',
            'bower_components/webcrypto-shim/webcrypto-shim.js',
            'bower_components/fastclick/lib/fastclick.js',
            'src/public/main.js'
        ])
        .pipe(concat('main.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('src/public'));
});
gulp.task('styles', function () {
    return gulp.src(['bower_components/bootstrap/dist/css/bootstrap.css',
            'bower_components/font-awesome/css/font-awesome.min.css',
            'bower_components/bootstrap-switch/dist/css/bootstrap3/bootstrap-switch.css',
            'src/public/style.css'
        ])
        .pipe(concat('style.min.css'))
        .pipe(cssnano())
        .pipe(gulp.dest('src/public'));
});
gulp.task('fonts', function() {
    gulp.src(['bower_components/Inconsolata/fonts/Regular/Inconsolata-Regular.ttf', 'bower_components/Inconsolata/fonts/Bold/Inconsolata-Bold.ttf','bower_components/font-awesome/fonts/fontawesome-webfont.ttf'])
        .pipe(fontmin())
        .pipe(gulp.dest("src/public/fonts"));
});
gulp.task('start', function () {
    nodemon({
        script: 'index.js',
        ext: 'css js mustache',
        ignore: ['src/public/main.js', 'src/public/main.min.js', 'src/public/style.min.css', 'test','node_modules','bower_components', 'src/public/fonts'],
        env: {
            'NODE_ENV': 'development'
        },
        tasks: ['scripts', 'styles', 'fonts']
    });
});

gulp.task('test', function () {
    let lintTest = spawn(
        'node_modules/mocha/bin/mocha', ['test/unit/lint.js', '--compilers', 'js:babel-core/register'], {
            stdio: 'inherit'
        }
    );

    lintTest.on('exit', function () {

        let unitTest = spawn('node_modules/karma/bin/karma', ['start', '--single-run'], {
            stdio: 'inherit'
        });

        unitTest.on('exit', function () {

            // Start app
            let app = spawn('node', ['index.js']);

            app.stdout.on('data', function (data) {
                console.log(String(data));
            });

            let acceptanceTest = spawn(
                'node_modules/nightwatch/bin/nightwatch', ['--test', 'test/acceptance/index.js', '--config', 'test/acceptance/nightwatch-local.json'], {
                    stdio: 'inherit'
                }
            );

            acceptanceTest.on('exit', function () {
                // Kill app Node process when tests are done
                app.kill();
            });

        });
    });

});
