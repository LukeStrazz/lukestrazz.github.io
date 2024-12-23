// Include gulp
var gulp = require('gulp'),
    connect = require('gulp-connect');

// Include Our Plugins
var postcss = require('gulp-postcss'),
    cssnano = require('cssnano'),
    rename = require('gulp-rename');

// Define paths
var paths = {
    html:['*.html'],
    css:['*.css'],
    assets:['assets/*']
}

// Copy HTML
gulp.task('copy-html', function() {
    return gulp.src('index.html')
        .pipe(gulp.dest('docs'));
});

gulp.task('copy-main', function() {
    return gulp.src('main.html')
        .pipe(gulp.dest('docs'));
});

// Copy CSS
gulp.task('copy-css', function() {
    return gulp.src('styles.css')
        .pipe(postcss([cssnano()]))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('docs'));
});

gulp.task('copy-maincss', function() {
    return gulp.src('main.css')
        .pipe(postcss([cssnano()]))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('docs'));
});

// Copy assets
gulp.task('copy-assets', function() {
    return gulp.src('assets/**/*')
        .pipe(gulp.dest('docs/assets'));
});


// Server task
gulp.task('connect', function() {
    connect.server({
        root: 'docs',
        port: 4042,
        livereload: true
    });
});


// Watch files for changes
gulp.task('watch', function() {
    gulp.watch(paths.html, gulp.series('copy-html'));
    gulp.watch(paths.html, gulp.series('copy-main'));
    gulp.watch(paths.css, gulp.series('copy-css'));
    gulp.watch(paths.assets, gulp.series('copy-assets'));
});

// Default Task
gulp.task('default', gulp.series('copy-html', 'copy-main', 'copy-css', 'copy-maincss', 'copy-assets', 'connect', 'watch'));
