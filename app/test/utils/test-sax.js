// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as sax from '../../modules/utils/sax.js';

test('sax', () => {
    const data = 
`<ListBucketResult>
  <Name>localhost</Name>
  <Prefix></Prefix>
  <Marker></Marker>
  <MaxKeys>100</MaxKeys>
  <Delimiter></Delimiter>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>test/</Key>
    <LastModified>2022-07-06T08:12:28.000Z</LastModified>
    <ETag>"D41D8CD98F00B204E9800998ECF8427E"</ETag>
    <Type>Normal</Type>
    <Size>0</Size>
    <StorageClass>Standard</StorageClass>
    <Owner>
      <ID>1812697572563535</ID>
      <DisplayName>1812697572563535</DisplayName>
    </Owner>
  </Contents>
  <Contents>
    <Key>test/test.json</Key>
    <LastModified>2022-07-06T08:12:54.000Z</LastModified>
    <ETag>"D013946ACA0FB94D9A82380FBB6ED679"</ETag>
    <Type>Normal</Type>
    <Size>3292</Size>
    <StorageClass>Standard</StorageClass>
    <Owner>
      <ID>1812697572563535</ID>
      <DisplayName>1812697572563535</DisplayName>
    </Owner>
  </Contents>
  <Contents>
    <Key>test/test.txt</Key>
    <LastModified>2022-07-06T09:47:38.000Z</LastModified>
    <ETag>"24346E1B50066607059AF36E3B684B24"</ETag>
    <Type>Normal</Type>
    <Size>9</Size>
    <StorageClass>Standard</StorageClass>
    <Owner>
      <ID>1812697572563535</ID>
      <DisplayName>1812697572563535</DisplayName>
    </Owner>
  </Contents>
</ListBucketResult>
`;

    const result = {};
    const stack = [result];
    let current = result;

    const parser = sax.parser();
    parser.onerror = function (e) {
        console.log('onerror ', e);
    };

    parser.onopentag = function (node) {
        const element = {};
        delete current.$text;

        current[node.name] = element;
        current = element;

        stack.push(element);

        // console.log('onopentag', node);
    };

    parser.onclosetag = function (node) {
        // console.log('onclosetag', node);

        stack.pop();
        current = stack[stack.length - 1];
    };

    parser.ontext = function (text) {
        const count = Object.keys(current).length;
        if (count == 0) {
            current.$text = text;
        }
    };

    parser.onend = function () {
        // console.log('onend');
    };

    parser.write(data);

    assert.ok(result.LISTBUCKETRESULT != null);
    // console.log(JSON.stringify(result, null, '  '));
});
