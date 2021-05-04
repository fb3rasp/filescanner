const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const fs = require('fs');

const path = require('path');
const md5 = require('js-md5');
const md5File = require('md5-file');

clear();

console.log(
  chalk.yellow(figlet.textSync('FileScanner', { horizontalLayout: 'full' }))
);

get_hash = (filename) => {
    const len = 1024;
    const buff = Buffer.alloc(len);

    const fd = fs.openSync(filename,'r');
    fs.readSync(fd, buff);
    fs.closeSync(fd);

    return md5(buff.toString());
}

const Walk = require("@root/walk");
const Spinner = require('cli-spinner').Spinner;
const cliProgress = require('cli-progress');
// const exif = require('exif2');

var hashes_by_size = {};
var hashes_on_1k = {};
var hashes_full = {};
var files_single = [];
var files_duplicate = [];

// get all files and their file-size
const scan_path = '../Pictures/';

console.log('Scan folder: '+ scan_path);

const walk = Walk.create({ withFileStats: true });

const spinner = new Spinner('Scanning directories for files... %s');
spinner.setSpinnerString('|/-\\');
spinner.start();

var number_of_files = 0;
var number_of_samesize_files = 0;
walk(scan_path, async function (err, pathname, stat) {
    
    if (stat.isFile()) {
        const filename = stat.name;
        const full_path = path.join(pathname);

        const file_size = stat.size; // in bytes    
        if (!hashes_by_size.hasOwnProperty(file_size)) {
            hashes_by_size[file_size] = [];
            number_of_samesize_files++;
        }
        hashes_by_size[file_size].push(full_path);
        number_of_files++
    }
}).then( async () => {

    spinner.stop();

    console.log('');
    console.log('Number of potential candidates: ' + number_of_samesize_files + " files of " + number_of_files + " in total")

    console.log(
        chalk.yellow('Scan files short hash (1024 byte hash).')
    );

    var file_number = 0;
    var number_of_same_shorthash = 0;

    // create a new progress bar instance and use shades_classic theme
    const progressBar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar1.start(number_of_samesize_files, 0);

    // const FileType = require('file-type');
    // var concurrent_tasks = 0;

    for (var size_in_bytes in hashes_by_size) {
        const files = hashes_by_size[size_in_bytes];
        file_number++;
        progressBar1.update(file_number);

        const supportedFiletypes = {
            'jpg': 'image/jpeg',
            'tif': 'image/tiff/jpeg',
            'dng': 'image/image/x-adobe-dng',
            'png': 'image/png',
            'mov': 'video/quicktime'
        };

/**
 *  ████████████████████████████████████████ 100% | ETA: 0s | 30001/30001
{
  xml: { ext: 'xml', mime: 'application/xml' },
  jpg: { ext: 'jpg', mime: 'image/jpeg' },
  mp4: { ext: 'mp4', mime: 'video/mp4' },
  tif: { ext: 'tif', mime: 'image/tiff' },
  dng: { ext: 'dng', mime: 'image/x-adobe-dng' },
  sqlite: { ext: 'sqlite', mime: 'application/x-sqlite3' },
  pdf: { ext: 'pdf', mime: 'application/pdf' },
  png: { ext: 'png', mime: 'image/png' },
  mov: { ext: 'mov', mime: 'video/quicktime' },
  m4v: { ext: 'm4v', mime: 'video/x-m4v' }
}
 */

        if (files.length < 2) {
            files_single.push(files[0]);
            // const fileType =  await FileType.fromFile(files[0]);
            // if (fileType) {
            //     if (supportedFiletypes[fileType.ext]) {
            //         concurrent_tasks = concurrent_tasks + 1;
            //         await exif(files[0], function(err, obj) {
            //             var exif_data = {};
            //             exif_data['file'] = files[0];
            //             exif_data['make'] = obj['make'];
            //             exif_data['filename'] = obj['file name'];
            //             exif_data['directory'] = obj['directory'];
            //             exif_data['createDate'] = obj['create date'];
            //             exif_data['dateTimeOriginal'] = obj['date time original'];
            //             files_metadata[files[0]] = exif_data;

            //             concurrent_tasks = concurrent_tasks - 1;
            //             if (concurrent_tasks == 0) {

            //                 // convert JSON object to string
            //                 const data = JSON.stringify(files_metadata, null, 2);

            //                 // write JSON string to a file
            //                 fs.writeFile('single_file_metadata.json', data, (err) => {
            //                     if (err) {
            //                         throw err;
            //                     }
            //                     console.log("JSON data is saved.");
            //                 });
            //                 console.log("done tasks");
            //             }
            //         });
            //     } else {
            //         files_metadata[files[0]] = [];
            //     }
            // }
            continue;
        }
    
        files.forEach((filename) => {
            const small_hash = get_hash(filename);
            const hash_index = new String(size_in_bytes + "," + small_hash).toString();
    
            if (!hashes_on_1k.hasOwnProperty(hash_index)) {
                hashes_on_1k[hash_index] = [];
                number_of_same_shorthash++;
            }
            hashes_on_1k[hash_index].push(filename);
        });
    };
    progressBar1.stop();

    console.log(
        chalk.yellow('Scan files full hash (md5).')
    );

    const bar2 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    var number_of_duplicates = 0;

    // start the progress bar with a total value of 200 and start value of 0
    bar2.start(number_of_same_shorthash, 0);
    file_number = 0;


    for (var hash in hashes_on_1k) {
        const files = hashes_on_1k[hash];

        file_number++;
        bar2.update(file_number);

        if (files.length < 2) 
            continue;
    
        files.forEach((filename) => {
            const full_hash = md5File.sync(filename);
            if (!hashes_full.hasOwnProperty(full_hash)) {
                hashes_full[full_hash] = [];
            }
            hashes_full[full_hash].push(filename);
        });
    };
    bar2.stop();
    
    var duplicate_index = 0;

    for (var full_hash in hashes_full) {
        const files = hashes_full[full_hash];
        if (files.length < 2) {
            files_single.push(files[0]);
            continue;
        }

        var index = 0;
        var file_item = [];

        files.forEach((filename) => {
            file_item['ref_filename'] = filename;
            if (index == 0) {
                file_item['ref_filename'] = filename;
                file_item['file_list'] = [];
                index++;
            } else {
                file_item['file_list'].push(filename);
            }
        });    
        files_duplicate.push(file_item);

    }

    // convert JSON object to string
    var data = JSON.stringify(files_single, null, 2);

    // write JSON string to a file
    fs.writeFile('files_single.json', data, (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });

    // convert JSON object to string
    var data = JSON.stringify(files_douplicate, null, 2);

    // write JSON string to a file
    fs.writeFile('files_douplicate.json', data, (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });
    
    console.log("Done");
});



